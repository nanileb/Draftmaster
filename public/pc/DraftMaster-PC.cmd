<# : DraftMaster PC (fichier Windows : la partie batch lance PowerShell, qui lit la suite de ce même fichier)
@echo off
title DraftMaster PC
set "DM_SELF=%~f0"
powershell -NoProfile -ExecutionPolicy Bypass -Command "& ([ScriptBlock]::Create([IO.File]::ReadAllText($env:DM_SELF, [Text.Encoding]::UTF8)))"
if errorlevel 1 pause
exit /b
#>

# ============================================================
# DraftMaster PC : lit la sélection des champions dans le client League de ce PC
# et l'envoie au relais DraftMaster, d'où l'application du téléphone la relit (Profil > PC relié).
# - Lecture seule : uniquement des lectures (GET) sur l'API locale du client League, comme Porofessor.
#   Rien n'est cliqué, choisi ou modifié dans le jeu.
# - Envoyé : la phase du client et la sélection des champions (bans, picks, postes), rien d'autre.
# - Se ferme tout seul quand la partie commence (rien ne tourne pendant la partie).
# - Réglages : %APPDATA%\DraftMaster\pc.json (code du PC et clé secrète). Supprimer ce fichier donne un nouveau code.
# ============================================================
$ErrorActionPreference = 'Stop'
$Version = '1.1'
$Relay = 'https://lol-support-coach.62z7h87vzm.workers.dev'
try { $Host.UI.RawUI.WindowTitle = 'DraftMaster PC' } catch {}
[Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
[Net.ServicePointManager]::Expect100Continue = $false

# Requêtes HTTP. Le client League répond sur 127.0.0.1 avec un certificat à lui : accepté pour 127.0.0.1 seulement,
# le relais garde la vérification normale.
Add-Type -TypeDefinition @'
using System;
using System.IO;
using System.Net;
using System.Net.Security;
using System.Security.Cryptography.X509Certificates;
using System.Text;

public class DmResult { public int Status; public string Text; }

public static class DmHttp {
  static bool AcceptLocal(object sender, X509Certificate cert, X509Chain chain, SslPolicyErrors errors) { return true; }

  public static DmResult Send(string method, string url, string auth, string body, int timeoutMs) {
    DmResult res = new DmResult();
    try {
      HttpWebRequest req = (HttpWebRequest)WebRequest.Create(url);
      req.Method = method;
      req.Timeout = timeoutMs;
      req.ReadWriteTimeout = timeoutMs;
      req.Accept = "application/json";
      req.UserAgent = "DraftMasterPC/1";
      if (req.RequestUri.Host == "127.0.0.1") {
        req.Proxy = null;
        req.ServerCertificateValidationCallback = AcceptLocal;
      }
      if (auth != null) req.Headers["Authorization"] = auth;
      if (body != null) {
        byte[] b = Encoding.UTF8.GetBytes(body);
        req.ContentType = "application/json";
        req.ContentLength = b.Length;
        using (Stream s = req.GetRequestStream()) { s.Write(b, 0, b.Length); }
      }
      HttpWebResponse resp = null;
      try { resp = (HttpWebResponse)req.GetResponse(); }
      catch (WebException e) {
        resp = e.Response as HttpWebResponse;
        if (resp == null) { res.Status = 0; res.Text = e.Message; return res; }
      }
      using (resp) {
        res.Status = (int)resp.StatusCode;
        using (StreamReader sr = new StreamReader(resp.GetResponseStream(), Encoding.UTF8)) { res.Text = sr.ReadToEnd(); }
      }
    } catch (Exception e) { res.Status = 0; res.Text = e.Message; }
    return res;
  }
}
'@

# ------------------------------------------------------------
# Code du PC et clé secrète (créés au premier lancement)
# ------------------------------------------------------------
function New-Rand([int]$n, [string]$alpha) {
  $b = New-Object byte[] $n
  [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b)
  $s = ''
  foreach ($x in $b) { $s += $alpha[$x % $alpha.Length] }
  return $s
}
$CfgDir = Join-Path $env:APPDATA 'DraftMaster'
$CfgFile = Join-Path $CfgDir 'pc.json'
function New-Config {
  $c = @{ code = (New-Rand 8 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'); key = (New-Rand 32 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789') }
  if (-not (Test-Path -LiteralPath $CfgDir)) { New-Item -ItemType Directory -Path $CfgDir | Out-Null }
  ('{"code":"' + $c.code + '","key":"' + $c.key + '"}') | Set-Content -LiteralPath $CfgFile -Encoding ASCII
  return $c
}
$Cfg = $null
try {
  if (Test-Path -LiteralPath $CfgFile) {
    $j = Get-Content -LiteralPath $CfgFile -Raw | ConvertFrom-Json
    if ($j.code -match '^[A-Z0-9]{8}$' -and $j.key -match '^[A-Za-z0-9]{20,64}$') { $Cfg = @{ code = $j.code; key = $j.key } }
  }
} catch {}
if (-not $Cfg) { $Cfg = New-Config }

# ------------------------------------------------------------
# Premier lancement : copie dans %LOCALAPPDATA%\DraftMaster et raccourci « DraftMaster PC » sur le Bureau
# ------------------------------------------------------------
$Shortcut = ''
try {
  $self = $env:DM_SELF
  $dest = Join-Path (Join-Path $env:LOCALAPPDATA 'DraftMaster') 'DraftMaster-PC.cmd'
  if ($self -and (Test-Path -LiteralPath $self) -and ($self -ne $dest)) {
    $dd = Split-Path $dest
    if (-not (Test-Path -LiteralPath $dd)) { New-Item -ItemType Directory -Path $dd | Out-Null }
    Copy-Item -LiteralPath $self -Destination $dest -Force
    try { Unblock-File -LiteralPath $dest } catch {}
    $desk = [Environment]::GetFolderPath('Desktop')
    $lnkPath = Join-Path $desk 'DraftMaster PC.lnk'
    $ws = New-Object -ComObject WScript.Shell
    $lnk = $ws.CreateShortcut($lnkPath)
    $lnk.TargetPath = $dest
    $lnk.WorkingDirectory = $dd
    $lnk.IconLocation = "$env:SystemRoot\System32\shell32.dll,15"
    $lnk.Description = 'DraftMaster PC : envoie la sélection des champions sur le téléphone'
    $lnk.Save()
    $Shortcut = 'Raccourci « DraftMaster PC » ajouté sur le Bureau : la prochaine fois, lance-le depuis là.'
  }
} catch {}

# ------------------------------------------------------------
# Client League : port et mot de passe de son API locale (ligne de commande du client, sinon fichier lockfile)
# ------------------------------------------------------------
function Get-Lcu {
  $proc = $null
  try { $proc = Get-CimInstance -ClassName Win32_Process -Filter "Name = 'LeagueClientUx.exe'" -ErrorAction Stop | Select-Object -First 1 } catch {}
  if ($proc -and $proc.CommandLine) {
    $port = [regex]::Match($proc.CommandLine, '--app-port=(\d+)').Groups[1].Value
    $tok = [regex]::Match($proc.CommandLine, '--remoting-auth-token=([^"\s]+)').Groups[1].Value
    if ($port -and $tok) { return @{ Port = $port; Token = $tok } }
  }
  if (-not $proc -and -not (Get-Process -Name 'LeagueClientUx' -ErrorAction SilentlyContinue)) { return $null }
  $dirs = @()
  if ($proc -and $proc.ExecutablePath) { $dirs += (Split-Path $proc.ExecutablePath) }
  $dirs += 'C:\Riot Games\League of Legends'
  foreach ($d in $dirs) {
    $f = Join-Path $d 'lockfile'
    if (Test-Path -LiteralPath $f) {
      try {
        $fs = [IO.File]::Open($f, 'Open', 'Read', 'ReadWrite')
        $sr = New-Object IO.StreamReader($fs)
        $parts = $sr.ReadToEnd().Split(':')
        $sr.Close(); $fs.Close()
        if ($parts.Length -ge 4) { return @{ Port = $parts[2]; Token = $parts[3] } }
      } catch {}
    }
  }
  return $null
}

function Lcu-Get($lcu, [string]$path) {
  $auth = 'Basic ' + [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes('riot:' + $lcu.Token))
  return [DmHttp]::Send('GET', ('https://127.0.0.1:' + $lcu.Port + $path), $auth, $null, 3000)
}

# ------------------------------------------------------------
# Affichage
# ------------------------------------------------------------
$PhaseFr = @{
  'Closed' = 'client League fermé'; 'None' = 'dans le client'; 'Lobby' = 'dans le salon'; 'Matchmaking' = 'recherche de partie';
  'ReadyCheck' = 'partie trouvée'; 'ChampSelect' = 'SÉLECTION DES CHAMPIONS'; 'GameStart' = 'chargement de la partie';
  'InProgress' = 'partie en cours'; 'Reconnect' = 'reconnexion'; 'WaitingForStats' = 'fin de partie'; 'PreEndOfGame' = 'fin de partie'; 'EndOfGame' = 'fin de partie'
}
$Shown = ''
function Show-Status([string]$phase, [string]$send) {
  $code = $Cfg.code.Substring(0, 4) + '-' + $Cfg.code.Substring(4)
  $p = $PhaseFr[$phase]; if (-not $p) { $p = $phase }
  $txt = "$code|$p|$send"
  if ($txt -eq $script:Shown) { return }
  $script:Shown = $txt
  Clear-Host
  Write-Host ''
  Write-Host '  DraftMaster PC' -ForegroundColor Cyan -NoNewline
  Write-Host "  (version $Version)" -ForegroundColor DarkGray
  Write-Host ''
  Write-Host '  Code du PC, à taper une fois dans DraftMaster sur ton téléphone (Profil > PC relié) :'
  Write-Host ''
  Write-Host "        $code" -ForegroundColor Yellow
  Write-Host ''
  Write-Host '  Client League : ' -NoNewline
  if ($phase -eq 'Closed') { Write-Host $p -ForegroundColor DarkGray } elseif ($phase -eq 'ChampSelect') { Write-Host $p -ForegroundColor Green } else { Write-Host $p -ForegroundColor White }
  Write-Host '  Téléphone     : ' -NoNewline
  if ($send -like 'OK*') { Write-Host $send -ForegroundColor Green } else { Write-Host $send -ForegroundColor Red }
  Write-Host ''
  Write-Host '  Laisse cette fenêtre ouverte (tu peux la réduire) : elle se ferme toute seule quand la partie commence.' -ForegroundColor DarkGray
  Write-Host '  Lecture seule : DraftMaster PC lit la sélection des champions, il ne touche à rien dans le jeu.' -ForegroundColor DarkGray
  if ($Shortcut) { Write-Host ''; Write-Host "  $Shortcut" -ForegroundColor DarkGray }
}

# ------------------------------------------------------------
# Boucle : lit le client (1 fois par seconde pendant la sélection, toutes les 3 s sinon) et envoie ce qui change
# ------------------------------------------------------------
$lcu = $null
$lastSig = ''
$lastSent = [DateTime]::MinValue
$send = 'en attente du premier envoi'
$fails = 0
$sawSelect = $false
Show-Status 'Closed' $send
while ($true) {
 try {
  $phase = 'Closed'
  $session = 'null'
  if (-not $lcu) { $lcu = Get-Lcu }
  if ($lcu) {
    $r = Lcu-Get $lcu '/lol-gameflow/v1/gameflow-phase'
    if ($r.Status -eq 0) { $lcu = $null }
    elseif ($r.Status -eq 200) { $phase = ($r.Text -replace '[^A-Za-z]', '') }
    elseif ($r.Status -eq 401) { $lcu = $null; $phase = 'None' }
    else { $phase = 'None' }
    if ($phase -eq '') { $phase = 'None' }
    if ($phase -eq 'ChampSelect') {
      $s = Lcu-Get $lcu '/lol-champ-select/v1/session'
      if ($s.Status -eq 200 -and $s.Text) { $session = $s.Text }
    }
  }

  $sig = $phase + '|' + $session
  $now = Get-Date
  if ($sig -ne $lastSig -or ($now - $lastSent).TotalSeconds -ge 20) {
    $body = '{"v":1,"key":"' + $Cfg.key + '","phase":"' + $phase + '","session":' + $session + '}'
    $res = [DmHttp]::Send('POST', ($Relay + '/pc?id=' + $Cfg.code), $null, $body, 8000)
    if ($res.Status -eq 200) {
      $lastSig = $sig; $lastSent = $now; $fails = 0
      $send = 'OK, dernier envoi à ' + $now.ToString('HH:mm:ss')
    } else {
      $fails++
      $lastSent = $now
      if ($res.Status -eq 403) {
        # Code déjà pris par un autre PC (très improbable) : nouveau code
        $Cfg = New-Config
        $send = 'code refusé : nouveau code créé, tape-le dans l''application'
      } elseif ($res.Status -eq 503) {
        $send = 'le relais DraftMaster n''est pas encore à jour, réessai automatique'
      } elseif ($res.Status -eq 0) {
        $send = 'pas de connexion internet ou relais injoignable, réessai automatique'
      } else {
        $send = 'erreur du relais (' + $res.Status + '), réessai automatique'
      }
    }
  }
  Show-Status $phase $send
  # Sélection terminée et partie lancée : on se ferme pour ne rien consommer en jeu
  if ($phase -eq 'ChampSelect') { $sawSelect = $true }
  if ($sawSelect -and (@('GameStart', 'InProgress', 'Reconnect') -contains $phase)) {
    Write-Host ''
    Write-Host '  Sélection terminée, la partie commence : DraftMaster PC se ferme pour ne rien consommer en jeu.' -ForegroundColor Cyan
    Write-Host '  Relance le raccourci « DraftMaster PC » avant ta prochaine partie.' -ForegroundColor DarkGray
    Start-Sleep -Seconds 4
    exit 0
  }
 } catch {
  # Erreur imprévue (client qui redémarre, etc.) : on recommence au tour suivant
  $lcu = $null; $phase = 'Closed'
 }
  if ($phase -eq 'ChampSelect') { Start-Sleep -Milliseconds 1000 }
  elseif ($fails -gt 3) { Start-Sleep -Seconds 10 }
  else { Start-Sleep -Seconds 3 }
}
