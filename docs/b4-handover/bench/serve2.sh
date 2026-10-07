#!/bin/bash
S=${S:?set S to the folder holding start-prod.sh and start-control.sh}
for p in $(ps -eo pid,cmd | awk '$2=="next-server" {print $1}'); do kill $p; done
sleep 2
case "$1" in control) f=$S/start-control.sh;; *) f=$S/start-prod.sh;; esac
(setsid bash $f > $S/server-$1.log 2>&1 &)
for i in $(seq 1 40); do curl -s -o /dev/null -w "%{http_code}" localhost:3000/ 2>/dev/null | grep -q 200 && break; sleep 1; done
for p in $(ps -eo pid,cmd | awk '$2=="next-server" {print $1}'); do echo "serving $1 from $(readlink /proc/$p/cwd)"; done
