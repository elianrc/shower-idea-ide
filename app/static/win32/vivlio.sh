#!/bin/sh

CONTENTS="$(dirname "$(dirname "$(dirname "$(dirname "$(realpath "$0")")")")")"
ELECTRON="$CONTENTS/Vivlio.exe"

if grep -q Microsoft /proc/version; then
	if [ -x /bin/wslpath ]; then
		export WSLENV=ELECTRON_RUN_AS_NODE/w:$WSLENV
		CLI=$(wslpath -m "$CONTENTS/resources/app/cli.js")
	else
		"$ELECTRON" "$@"
		exit $?
	fi
elif [ "$(expr substr $(uname -s) 1 9)" = "CYGWIN_NT" ]; then
	CLI=$(cygpath -m "$CONTENTS/resources/app/cli.js")
else
	CLI="$CONTENTS/resources/app/cli.js"
fi

ELECTRON_RUN_AS_NODE=1 "$ELECTRON" "$CLI" "$@"

exit $?
