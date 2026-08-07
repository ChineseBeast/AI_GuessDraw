#!/usr/bin/env bash
set -e

JSON_MODE=false
for arg in "$@"; do
    case "$arg" in
        --json) JSON_MODE=true ;;
        --help|-h) echo "Usage: $0 [--json]"; exit 0 ;;
        *) echo "ERROR: Unknown option '$arg'" >&2; exit 1 ;;
    esac
done

SCRIPT_DIR="$(CDPATH="" cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"

_paths_output=$(get_feature_paths) || { echo "ERROR: Failed to resolve feature paths" >&2; exit 1; }
eval "$_paths_output"
unset _paths_output

if [[ ! -f "$IMPL_PLAN" ]]; then
    echo "ERROR: plan.md not found in $FEATURE_DIR" >&2
    echo "Run /speckit.plan first to create the implementation plan." >&2
    exit 1
fi
if [[ ! -f "$FEATURE_SPEC" ]]; then
    echo "ERROR: spec.md not found in $FEATURE_DIR" >&2
    echo "Run /speckit.specify first to create the feature structure." >&2
    exit 1
fi

docs=()
[[ -f "$RESEARCH" ]] && docs+=("research.md")
[[ -f "$DATA_MODEL" ]] && docs+=("data-model.md")
if [[ -d "$CONTRACTS_DIR" ]] && [[ -n "$(ls -A "$CONTRACTS_DIR" 2>/dev/null)" ]]; then
    docs+=("contracts/")
fi
[[ -f "$QUICKSTART" ]] && docs+=("quickstart.md")

TASKS_TEMPLATE=$(resolve_template "tasks-template" "$REPO_ROOT") || true
if [[ -z "$TASKS_TEMPLATE" ]] || [[ ! -f "$TASKS_TEMPLATE" ]]; then
    echo "ERROR: Could not resolve tasks-template" >&2
    exit 1
fi

if $JSON_MODE; then
    if has_jq; then
        json_docs=$(printf '%s\n' "${docs[@]}" | jq -R . | jq -s .) 2>/dev/null || json_docs="[]"
        jq -cn --arg feature_dir "$FEATURE_DIR" --argjson docs "$json_docs" --arg tasks_template "${TASKS_TEMPLATE:-}" \
            '{FEATURE_DIR:$feature_dir,AVAILABLE_DOCS:$docs,TASKS_TEMPLATE:$tasks_template}'
    else
        printf '{"FEATURE_DIR":"%s","AVAILABLE_DOCS":[],"TASKS_TEMPLATE":"%s"}\n' "$(json_escape "$FEATURE_DIR")" "$(json_escape "${TASKS_TEMPLATE:-}")"
    fi
else
    echo "FEATURE_DIR: $FEATURE_DIR"
    echo "TASKS_TEMPLATE: ${TASKS_TEMPLATE:-not found}"
    echo "AVAILABLE_DOCS:"
    check_file "$RESEARCH" "research.md"
    check_file "$DATA_MODEL" "data-model.md"
    check_dir "$CONTRACTS_DIR" "contracts/"
    check_file "$QUICKSTART" "quickstart.md"
fi
