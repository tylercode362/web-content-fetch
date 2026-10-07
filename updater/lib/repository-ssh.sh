#!/bin/sh
# Fixed Git transport only. Git constructs the remote upload-pack argument from a validated slug.
set -eu
: "${REPO_SSH_KEY_PATH:?}" "${REPO_KNOWN_HOSTS_PATH:?}"
exec /usr/bin/ssh -F /dev/null -T \
  -o BatchMode=yes -o IdentitiesOnly=yes -o IdentityAgent=none \
  -o PasswordAuthentication=no -o KbdInteractiveAuthentication=no \
  -o PreferredAuthentications=publickey -o StrictHostKeyChecking=yes \
  -o GlobalKnownHostsFile=/dev/null -o "UserKnownHostsFile=$REPO_KNOWN_HOSTS_PATH" \
  -o HostKeyAlgorithms=ssh-ed25519 -o UpdateHostKeys=no -o VerifyHostKeyDNS=no \
  -o ConnectTimeout=10 -o ConnectionAttempts=1 -o ServerAliveInterval=5 \
  -o ServerAliveCountMax=2 -o ForwardAgent=no -o ClearAllForwardings=yes \
  -o ControlMaster=no -o ControlPath=none -o ProxyCommand=none \
  -i "$REPO_SSH_KEY_PATH" "$@"
