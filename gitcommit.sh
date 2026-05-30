#!/bin/bash
cd /opt/OmniAccess
git config user.email "desarrollo@favaro.com.uy" 2>/dev/null
git config user.name "OmniAccess" 2>/dev/null
git add -A
git commit -q -m "feat: aforo/dispatch pipeline (Redis+BullMQ), OpenWA WhatsApp, ffmpeg clips, ONVIF health alerts, PWA supervisor, MinIO browser, report branding, map live video; docs (README + INSTALL: monolito/contenedores, persistencia, recuperación)" 2>&1 | tail -3
echo "=== commit head ==="
git log --oneline -1
echo "=== push (no prompt) ==="
GIT_TERMINAL_PROMPT=0 timeout 30 git push origin main 2>&1 | tail -6 || echo "PUSH_FAILED_OR_TIMEOUT"
