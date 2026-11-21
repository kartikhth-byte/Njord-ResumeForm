#!/bin/sh
# Update signatures (failure stops the service: it fails closed), start the
# resident scanner, wait until it answers, then serve. Uploads never run unscanned.
set -e
freshclam --stdout
clamd -c /app/clamd.conf
i=0
until [ -S /tmp/clamd.sock ]; do
  i=$((i+1)); [ "$i" -gt 180 ] && { echo "clamd did not start"; exit 1; }
  sleep 1
done
exec gunicorn --bind 0.0.0.0:${PORT:-8080} --workers 1 --threads 4 --timeout 180 'app:create_app()'
