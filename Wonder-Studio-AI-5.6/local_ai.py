"""Motores locales opcionales de Wonder Studio AI.

No contiene clientes, tokens ni endpoints de servicios de IA remotos. Únicamente
accede a 127.0.0.1 en los puertos locales de Ollama y ComfyUI.
"""
from __future__ import annotations
import base64
import json
import os
import re
import secrets
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

OLLAMA='http://127.0.0.1:11434'
COMFY='http://127.0.0.1:8188'
DEFAULT_TEXT_MODEL='gemma3:1b'
MAX_GENERATED_IMAGE=20*1024*1024

class LocalAIError(RuntimeError):
    pass

def request(url, data=None, timeout=4, max_bytes=2_000_000):
    if not (url.startswith(OLLAMA+'/') or url.startswith(COMFY+'/')):
        raise LocalAIError('Se rechazó una dirección que no es un motor local aprobado.')
    payload=None if data is None else json.dumps(data, ensure_ascii=False).encode('utf-8')
    req=urllib.request.Request(url, payload,
        headers={'Content-Type':'application/json'} if payload is not None else {},
        method='POST' if payload is not None else 'GET')
    try:
        with urllib.request.urlopen(req, timeout=timeout) as res:
            raw=res.read(max_bytes+1)
            if len(raw)>max_bytes:raise LocalAIError('La respuesta del motor local es demasiado grande.')
            return raw
    except (urllib.error.URLError, TimeoutError, OSError) as e:
        raise LocalAIError(f'El motor local no respondió: {str(e)[:240]}')

def jget(url, timeout=2):
    return json.loads(request(url, timeout=timeout))

def jpost(url, data, timeout=130):
    return json.loads(request(url, data, timeout=timeout, max_bytes=3_000_000))

def ollama_models():
    try:
        models=jget(OLLAMA+'/api/tags', 2).get('models',[])
        return [m.get('name','') for m in models if isinstance(m,dict) and m.get('name')][:100]
    except (LocalAIError,ValueError,TypeError):return []

def comfy_models():
    try:
        result=jget(COMFY+'/models/checkpoints',2)
        return [x for x in result if isinstance(x,str)][:100] if isinstance(result,list) else []
    except (LocalAIError,ValueError,TypeError):return []

def get_config(path):
    try:
        v=json.loads(Path(path).read_text('utf-8'))
        return v if isinstance(v,dict) else {}
    except (OSError,ValueError):return {}

def set_config(path,data):
    c={}
    for key in ('text_model','vision_model','checkpoint'):
        v=str(data.get(key,'')).strip()
        if v and (len(v)>150 or any(x in v for x in ('\n','\r','\x00'))):
            raise ValueError('Nombre de modelo inválido')
        c[key]=v
    target=Path(path); target.parent.mkdir(parents=True,exist_ok=True)
    tmp=target.with_suffix('.tmp');tmp.write_text(json.dumps(c,ensure_ascii=False,indent=2),'utf-8')
    os.replace(tmp,target)
    return c

def status(config_path):
    c=get_config(config_path)
    models=ollama_models(); checkpoints=comfy_models()
    text=c.get('text_model') if c.get('text_model') in models else (models[0] if models else '')
    vision=c.get('vision_model') if c.get('vision_model') in models else ''
    checkpoint=c.get('checkpoint') if c.get('checkpoint') in checkpoints else (checkpoints[0] if checkpoints else '')
    return {'enabled':bool(text),'chat_ready':bool(text),'vision_ready':bool(vision),
            'image_ready':bool(checkpoint),'text_model':text,'vision_model':vision,
            'image_model':checkpoint,'models':models,'checkpoints':checkpoints,
            'ollama_online':bool(models),'comfy_online':bool(checkpoints),
            'provider':'Modelos en el equipo · sin clave API',
            'setup':'Instala Ollama y ejecuta ollama pull gemma3:1b para chat. '
                    'Para imágenes fotográficas instala ComfyUI y un checkpoint compatible.'}

def chat(messages,system,model):
    if not model:raise LocalAIError('No hay modelo de chat instalado. Instala Ollama y ejecuta: ollama pull gemma3:1b')
    m=[{'role':'system','content':system}]
    for x in messages[-24:]:
        if x.get('role') in ('assistant','user'):
            m.append({'role':x['role'],'content':str(x.get('content',''))[:5000]})
    obj=jpost(OLLAMA+'/api/chat',{'model':model,'messages':m,'stream':False,
                                    'options':{'temperature':0.6,'num_predict':700}},timeout=210)
    answer=obj.get('message',{}).get('content','')
    if not answer:raise LocalAIError('El modelo local no devolvió una respuesta de texto.')
    return str(answer)

def analyze(image,mime,model):
    if not model:raise LocalAIError('Selecciona un modelo multimodal local instalado (por ejemplo gemma3:4b).')
    prompt=('Eres un catalogador profesional. Analiza únicamente la imagen adjunta. '
            'Responde exclusivamente JSON: {"categoria":"Logotipo|Personaje|Fondo|Elemento|General",'
            '"descripcion":"...","etiquetas":["..."],"colores":["#RRGGBB"],"observaciones":"..."}. '
            'No declares logos oficiales sin confirmación. No identifiques personas.')
    result=jpost(OLLAMA+'/api/chat',{'model':model,'stream':False,'format':'json',
                'messages':[{'role':'user','content':prompt,
                             'images':[base64.b64encode(image).decode('ascii')]}],
                'options':{'num_predict':500}},timeout=250)
    text=str(result.get('message',{}).get('content','')).strip()
    if text.startswith('```'):text=re.sub(r'^```(?:json)?\s*|\s*```$','',text)
    try:
        v=json.loads(text)
        if not isinstance(v,dict):raise ValueError('no object')
        return v
    except ValueError:raise LocalAIError('El modelo no devolvió el análisis en formato JSON válido.')

def generate(prompt,ratio,checkpoint):
    if not checkpoint:raise LocalAIError('No hay checkpoint de imagen en ComfyUI. Abre ComfyUI y carga un modelo.')
    sizes={'1/1':(512,512),'4/5':(512,640),'9/16':(448,768),'16/9':(768,448)}
    w,h=sizes.get(ratio,(512,512))
    prompt=str(prompt).strip()
    if not 5<=len(prompt)<=2000:raise ValueError('Describe el fondo con 5 a 2000 caracteres')
    if len(checkpoint)>150:raise ValueError('Checkpoint inválido')
    # API JSON workflow standard; a ComfyUI checkpoint must expose CLIP, MODEL and VAE.
    graph={
      '4':{'class_type':'CheckpointLoaderSimple','inputs':{'ckpt_name':checkpoint}},
      '5':{'class_type':'EmptyLatentImage','inputs':{'width':w,'height':h,'batch_size':1}},
      '6':{'class_type':'CLIPTextEncode','inputs':{'text':prompt+', professional commercial artwork, no text, no letters, no watermark','clip':['4',1]}},
      '7':{'class_type':'CLIPTextEncode','inputs':{'text':'text, logo, watermark, words, poor quality, artifacts','clip':['4',1]}},
      '3':{'class_type':'KSampler','inputs':{'seed':secrets.randbelow(2**32),'steps':18,'cfg':7.0,
          'sampler_name':'euler','scheduler':'normal','denoise':1.0,'model':['4',0],
          'positive':['6',0],'negative':['7',0],'latent_image':['5',0]}},
      '8':{'class_type':'VAEDecode','inputs':{'samples':['3',0],'vae':['4',2]}},
      '9':{'class_type':'SaveImage','inputs':{'filename_prefix':'WonderStudioLocal','images':['8',0]}}
    }
    response=jpost(COMFY+'/prompt',{'prompt':graph,'client_id':'wonder-studio-local'},timeout=15)
    prompt_id=response.get('prompt_id')
    if not prompt_id:raise LocalAIError('ComfyUI rechazó el workflow: '+str(response.get('error',response))[:280])
    if not re.fullmatch(r'[a-zA-Z0-9-]{10,100}',prompt_id):raise LocalAIError('ID de ComfyUI inválido')
    for _ in range(150):
        time.sleep(2)
        try:history=jget(COMFY+'/history/'+prompt_id,timeout=6)
        except (LocalAIError, ValueError):continue
        item=history.get(prompt_id)
        if not item:continue
        if item.get('status',{}).get('status_str')=='error':
            raise LocalAIError('ComfyUI no pudo generar la imagen. Revisa la compatibilidad del checkpoint y workflow.')
        for node in item.get('outputs',{}).values():
            if not isinstance(node,dict):continue
            for file in node.get('images',[]):
                values={k:str(file.get(k,'')) for k in ('filename','subfolder','type')}
                url=COMFY+'/view?'+urllib.parse.urlencode(values)
                raw=request(url,timeout=25,max_bytes=MAX_GENERATED_IMAGE)
                if raw.startswith(b'\x89PNG\r\n\x1a\n'):
                    return 'data:image/png;base64,'+base64.b64encode(raw).decode('ascii')
                raise LocalAIError('ComfyUI devolvió un archivo de imagen desconocido.')
        raise LocalAIError('ComfyUI terminó pero no produjo imágenes descargables.')
    raise LocalAIError('La generación local superó 5 minutos. Revisa la cola de ComfyUI.')
