const express = require('express');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Gumawa ng Cloud Vault Storage Folder sa server para sa mga dinidownload na apps/files
const STORAGE_DIR = path.join(__dirname, 'cloud_vault_storage');
if (!fs.existsSync(STORAGE_DIR)){
    fs.mkdirSync(STORAGE_DIR, { recursive: true });
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 1. ANG WEB BROWSER UI (Dito magse-search, magba-browse, at magpapatakbo ang user)
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>PogiAko Super Cloud Browser</title>
        <style>
          body { font-family: Arial, sans-serif; background: #0f172a; color: #f8fafc; margin: 0; padding: 12px; }
          .header { display: flex; gap: 8px; background: #1e293b; padding: 12px; border-radius: 8px; margin-bottom: 12px; box-shadow: 0 4px 10px rgba(0,0,0,0.3); }
          input[type="text"] { flex: 1; padding: 12px; background: #0f172a; border: 1px solid #334155; color: #fff; border-radius: 6px; font-size: 14px; outline: none; }
          input[type="text"]:focus { border-color: #38bdf8; }
          button { background: #0284c7; color: white; border: none; padding: 12px 18px; cursor: pointer; border-radius: 6px; font-weight: bold; font-size: 14px; }
          button:hover { background: #0369a1; }
          .screen-box { width: 100%; height: 68vh; background: #000; border: 1px solid #334155; border-radius: 8px; overflow: hidden; display: flex; flex-direction: column; align-items: center; justify-content: center; }
          iframe { width: 100%; height: 100%; border: none; }
          .download-section { margin-top: 12px; background: #1e293b; padding: 12px; border-radius: 8px; text-align: center; }
          .info { font-size: 11px; color: #94a3b8; text-align: center; margin-top: 8px; }
          #status { margin-top: 8px; font-size: 13px; color: #4ade80; word-break: break-all; }
        </style>
    </head>
    <body>
        <div class="header">
            <input type="text" id="urlInput" placeholder="I-type ang URL, website, o video link dito..." />
            <button onclick="loadSite()">Go / Stream</button>
        </div>
        
        <div class="screen-box" id="viewer">
            <p style="color: #64748b; text-align: center; padding: 20px;">I-enter ang link sa itaas. Server ang hihigop ng data para sa mabilis na panonood at pag-browse nang walang lag!</p>
        </div>

        <div class="download-section">
            <p style="margin: 0 0 8px 0; font-size: 13px; color: #38bdf8;">High-Speed Server Downloader (1GB+ Files):</p>
            <div style="display: flex; gap: 8px;">
                <input type="text" id="downloadInput" placeholder="I-paste ang Direct Download Link ng App dito..." />
                <button style="background: #10b981;" onclick="startServerDownload()">Download</button>
            </div>
            <div id="status"></div>
        </div>

        <div class="info">Status: Connected sa PogiAko High-Speed Cloud Server (Bypass Local KB/s Speed)</div>

        <script>
          function loadSite() {
            let url = document.getElementById('urlInput').value;
            if(!url) return;
            if(!url.startsWith('http')) { url = 'https://' + url; }
            
            let viewer = document.getElementById('viewer');
            viewer.innerHTML = '<iframe src="/proxy?url=' + encodeURIComponent(url) + '"></iframe>';
          }

          async function startServerDownload() {
            let url = document.getElementById('downloadInput').value;
            let statusDiv = document.getElementById('status');
            if(!url) { alert('Maglagay muna ng download link!'); return; }
            
            statusDiv.innerHTML = "<b>Sandali lang...</b> Ang Cloud Server ang kumakayod sa pag-download ng malaking file...";
            
            try {
              let res = await fetch('/download-file', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: url })
              });
              let data = await res.json();
              if(data.success) {
                statusDiv.innerHTML = "<b>Tagumpay!</b> Nai-save na sa Cloud Vault: " + data.fileName;
              } else {
                statusDiv.innerHTML = "<span style='color: #f87171;'>Error: " + data.error + "</span>";
              }
            } catch(e) {
              statusDiv.innerHTML = "<span style='color: #f87171;'>Network Error: " + e.message + "</span>";
            }
          }
        </script>
    </body>
    </html>
  `);
});

// 2. HIGH-SPEED PROXY & STREAMING ENGINE (Para sa Smooth Browsing at Video Streaming nang walang lag sa mahinang signal)
app.get('/proxy', async (req, res) => {
  const targetUrl = req.query.url;
  if (!targetUrl) return res.status(400).send("Walang URL na ibinigay.");

  try {
    const response = await fetch(targetUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      }
    });
    
    const contentType = response.headers.get('content-type');
    res.setHeader('Content-Type', contentType || 'text/html');
    response.body.pipe(res);
  } catch (err) {
    res.status(500).send("Error sa pag-load ng site sa pamamagitan ng server: " + err.message);
  }
});

// 3. SERVER-SIDE DOWNLOAD ENGINE (Dito bina-bash ng server ang 1GB+ files papunta sa storage vault nang hindi nagagalaw ang mahinang signal mo)
app.post('/download-file', async (req, res) => {
  const fileUrl = req.body.url;
  if (!fileUrl) return res.json({ success: false, error: "Walang ibinigay na URL." });

  try {
    const response = await fetch(fileUrl);
    if (!response.ok) throw new Error("Nabigong i-fetch ang file mula sa source.");

    let fileName = fileUrl.substring(fileUrl.lastIndexOf('/') + 1).split('?')[0] || "app.apk";
    if (!fileName.endsWith('.apk') && !fileName.includes('.')) fileName += ".apk";

    const filePath = path.join(STORAGE_DIR, fileName);
    const fileStream = fs.createWriteStream(filePath);

    await new Promise((resolve, reject) => {
        response.body.pipe(fileStream);
        response.body.on('error', reject);
        fileStream.on('finish', resolve);
    });

    res.json({ success: true, fileName: fileName });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// 4. VAULT FILE LIST & DOWNLOAD PATH PARA SA APP MO
app.get('/files', (req, res) => {
    fs.readdir(STORAGE_DIR, (err, files) => {
        if (err) return res.status(500).json({ error: "Hindi mabasa ang storage." });
        res.json({ files });
    });
});

app.use('/vault', express.static(STORAGE_DIR));

app.listen(PORT, () => {
  console.log(`PogiAko Super Cloud Server running on port ${PORT}`);
});
           
