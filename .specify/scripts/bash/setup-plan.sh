#!/usr/bin/env bash
set -e

JSON_MODE=false
ARGS=()

for arg in "$@"; do
    case "$arg" in
        --json) JSON_MODE=true ;;
        --help|-h)
            echo "Usage: $0 [--json]"
            echo "  --json    Output results in JSON format"
            exit 0 ;;
        *) ARGS+=("$arg") ;;
    esac
done

SCRIPT_DIR="$(CDPATH="" cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"

_paths_output=$(get_feature_paths) || { echo "ERROR: Failed to resolve feature paths" >&2; exit 1; }
eval "$_paths_output"
unset _paths_output

mkdir -p "$FEATURE_DIR"

if [[ -f "$IMPL_PLAN" ]]; then
    $JSON_MODE && echo "Plan already exists at $IMPL_PLAN, skipping template copy" >&2 || echo "Plan already exists at $IMPL_PLAN, skipping template copy"
else
    TEMPLATE=$(resolve_template "plan-template" "$REPO_ROOT") || true
    if [[ -n "$TEMPLATE" ]] && [[ -f "$TEMPLATE" ]]; then
        cp "$TEMPLATE" "$IMPL_PLAN"
        $JSON_MODE && echo "Copied plan template to $IMPL_PLAN" >&2 || echo "Copied plan template to $IMPL_PLAN"
    else
        $JSON_MODE && echo "Warning: Plan template not found" >&2 || echo "Warning: Plan template not found"
        touch "$IMPL_PLAN"
    fi
fi

if $JSON_MODE; then
    if has_jq; then
        jq -cn --arg feature_spec "$FEATURE_SPEC" --arg impl_plan "$IMPL_PLAN" --arg specs_dir "$FEATURE_DIR" --arg branch "$CURRENT_BRANCH" \
            '{FEATURE_SPEC:$feature_spec,IMPL_PLAN:$impl_plan,SPECS_DIR:$specs_dir,BRANCH:$branch}'
    else
        printf '{"FEATURE_SPEC":"%s","IMPL_PLAN":"%s","SPECS_DIR":"%s","BRANCH":"%s"}\n' \
            "$(json_escape "$FEATURE_SPEC")" "$(json_escape "$IMPL_PLAN")" "$(json_escape "$FEATURE_DIR")" "$(json_escape "$CURRENT_BRANCH")"
    fi
else
    echo "FEATURE_SPEC: $FEATURE_SPEC"
    echo "IMPL_PLAN: $IMPL_PLAN"
    echo "SPECS_DIR: $FEATURE_DIR"
    echo "BRANCH: $CURRENT_BRANCH"
fi
