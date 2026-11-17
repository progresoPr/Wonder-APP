package main

import (
    "archive/zip"
    "bytes"
    _ "embed"
    "fmt"
    "io"
    "os"
    "os/exec"
    "path/filepath"
    "strings"
)

//go:embed payload.zip
var appArchive []byte

func fail(err error) {
    fmt.Fprintln(os.Stderr, "WONDER STUDIO AI — No pudo abrir la aplicacion:", err)
    fmt.Fprintln(os.Stderr, "NO se borraron ni modificaron tus proyectos en la carpeta data.")
    fmt.Print("Pulsa Enter para salir...")
    var answer string
    fmt.Scanln(&answer)
    os.Exit(1)
}
func unpack(dir string) error {
    if err:=os.MkdirAll(dir,0755); err!=nil{return err}
    z,err:=zip.NewReader(bytes.NewReader(appArchive),int64(len(appArchive)))
    if err!=nil{return err}
    for _,f:=range z.File {
        if f.FileInfo().IsDir() {continue}
        name:=filepath.Clean(f.Name)
        if filepath.IsAbs(name)||strings.HasPrefix(name,"..")||strings.Contains(name,":") {return fmt.Errorf("archivo interno no valido: %q",name)}
        dest:=filepath.Join(dir,name)
        if !strings.HasPrefix(dest,dir+string(os.PathSeparator)){return fmt.Errorf("ruta insegura: %q",dest)}
        if err=os.MkdirAll(filepath.Dir(dest),0755);err!=nil{return err}
        in,e:=f.Open();if e!=nil{return e}
        out,e:=os.Create(dest);if e!=nil{in.Close();return e}
        _,e=io.Copy(out,in);out.Close();in.Close();if e!=nil{return e}
    }
    return nil
}
func pythonRunner() (string,[]string,error) {
    if name,err:=exec.LookPath("py.exe");err==nil {
        test:=exec.Command(name,"-3","--version");if test.Run()==nil{return name,[]string{"-3"},nil}
    }
    for _,name:=range []string{"python.exe","python3.exe"} {
        if p,err:=exec.LookPath(name);err==nil {
            probe:=exec.Command(p,"--version");if probe.Run()==nil{return p,[]string{},nil}
        }
    }
    return "",nil,fmt.Errorf("Python estable no esta instalado. Instala Python 3.11+ (64 bits) desde python.org y vuelve a abrir el EXE. Los modelos de IA no necesitan claves API")
}
func main() {
    local:=os.Getenv("LOCALAPPDATA")
    if local==""{home,_:=os.UserHomeDir();local=filepath.Join(home,"AppData","Local")}
    base:=filepath.Join(local,"WonderStudioAI")
    appDir:=filepath.Join(base,"app","5.6")
    dataDir:=filepath.Join(base,"data")
    if err:=os.MkdirAll(dataDir,0700);err!=nil{fail(err)}
    if err:=unpack(appDir);err!=nil{fail(err)}
    py,pre,err:=pythonRunner();if err!=nil{fail(err)}
    args:=append(pre,filepath.Join(appDir,"desktop.py"))
    command:=exec.Command(py,args...)
    command.Dir=appDir
    command.Env=append(os.Environ(),"WS_DATA_DIR="+dataDir,"PYTHONUTF8=1")
    command.Stdin=os.Stdin;command.Stdout=os.Stdout;command.Stderr=os.Stderr
    fmt.Println("Wonder Studio AI 5.6 — iniciando editor privado...")
    fmt.Println("Datos y proyectos protegidos en:",dataDir)
    fmt.Println("Esta ventana controla el motor local. Puedes minimizarla.")
    if err:=command.Run();err!=nil{fail(err)}
}
