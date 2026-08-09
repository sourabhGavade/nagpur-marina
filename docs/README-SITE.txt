Nagpur Marina — site install
============================

What you need on this PC
------------------------
1. Docker Desktop for Windows (installed and started once)
2. This folder with:
   - nagpur-marina.tar   (the application image)
   - run.bat
   - stop.bat
3. Caddy is optional and stays installed separately if you already use it.
   run.bat starts Caddy only if it finds:
   C:\Users\admin\Documents\caddy\caddy_windows_amd64.exe
   Edit CADDY_FOLDER in run.bat if your path differs.

How to start (operator)
-----------------------
1. Start Docker Desktop and wait until it says it is running.
2. Double-click run.bat
3. The TV browser should open fullscreen. Use the tablet browser at:
   http://THIS-PC-LAN-IP:3000

How to stop
-----------
Double-click stop.bat

Ports used (same as before Docker)
----------------------------------
- 3000  Tablet UI
- 3001  TV UI
- 4000  Socket.IO server (+ /health)

Caddy can reverse-proxy to localhost:3000, :3001, and :4000 as before.
Do not make Caddy and Docker both bind the same public port.

Hardware
--------
Raspberry Pis connect to:  http://THIS-PC-LAN-IP:4000
For demos without Pis, edit run.bat and set:
  set "ENABLE_MOCK_HARDWARE=1"
Do not use mock hardware and real Pis at the same time.

Internet
--------
On first start the server checks a remote enable config over HTTPS.
The PC needs outbound internet for that check, or the container will exit.

Updating the app
----------------
Replace nagpur-marina.tar with a new export, then run.bat again
(it will load the new image if the tag is missing, or remove the old
container and docker load a newly tagged build as instructed by your team).
