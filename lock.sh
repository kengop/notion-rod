#!/usr/bin/env bash

set -Eeuo pipefail

timestamp=$(date +%s)
python3 -m venv ".venv_temp_${timestamp}"
# shellcheck source=/dev/null
source ".venv_temp_${timestamp}/bin/activate"
pip install -U pip wheel
pip install -r requirements.txt
pip freeze >|requirements.lock
rm -rf ".venv_temp_${timestamp}"