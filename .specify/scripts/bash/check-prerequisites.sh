#!/usr/bin/env bash
set -e

JSON_MODE=false
REQUIRE_TASKS=false
INCLUDE_TASKS=false
PATHS_ONLY=false

for arg in "$@"; do
    case "$arg" in
        --json) JSON_MODE=true ;;
        --require-tasks) REQUIRE_TASKS=true ;;
        --include-tasks) INCLUDE_TASKS=true ;;
        --paths-only) PATHS_ONLY=true ;;
        --help|-h)
            cat << 'EOF'
Usage: check-prerequisites.sh [OPTIONS]
OPTIONS:
  --json              Output in JSON format
  --require-tasks     Require tasks.md to exist
  --include-tasks     Include tasks.md in AVAILABLE_DOCS
  --paths-only        Only output path variables
EOF
            exit 0 ;;
        *) echo "ERROR: Unknown option '$arg'" >&2; exit 1 ;;
    esac
done

SCRIPT_DIR="$(CDPATH="" cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"

if $PATHS_ONLY; then
    _paths_output=$(get_feature_paths --no-persist) || { echo "ERROR: Failed to resolve feature paths" >&2; exit 1; }
else
    _paths_output=$(get_feature_paths) || { echo "ERROR: Failed to resolve feature paths" >&2; exit 1; }
fi
eval "$_paths_output"
unset _paths_output

if $PATHS_ONLY; then
    if $JSON_MODE; then
        if has_jq; then
            jq -cn --arg repo_root "$REPO_ROOT" --arg branch "$CURRENT_BRANCH" --arg feature_dir "$FEATURE_DIR" \
                --arg feature_spec "$FEATURE_SPEC" --arg impl_plan "$IMPL_PLAN" --arg tasks "$TASKS" \
                '{REPO_ROOT:$repo_root,BRANCH:$branch,FEATURE_DIR:$feature_dir,FEATURE_SPEC:$feature_spec,IMPL_PLAN:$impl_plan,TASKS:$tasks}'
        else
            printf '{"REPO_ROOT":"%s","BRANCH":"%s","FEATURE_DIR":"%s","FEATURE_SPEC":"%s","IMPL_PLAN":"%s","TASKS":"%s"}\n' \
                "$(json_escape "$REPO_ROOT")" "$(json_escape "$CURRENT_BRANCH")" "$(json_escape "$FEATURE_DIR")" \
                "$(json_escape "$FEATURE_SPEC")" "$(json_escape "$IMPL_PLAN")" "$(json_escape "$TASKS")"
        fi
    else
        echo "REPO_ROOT: $REPO_ROOT"
        echo "BRANCH: $CURRENT_BRANCH"
        echo "FEATURE_DIR: $FEATURE_DIR"
        echo "FEATURE_SPEC: $FEATURE_SPEC"
        echo "IMPL_PLAN: $IMPL_PLAN"
        echo "TASKS: $TASKS"
    fi
    exit 0
fi

if [[ ! -d "$FEATURE_DIR" ]]; then
    echo "ERROR: Feature directory not found: $FEATURE_DIR" >&2
    exit 1
fi
if [[ ! -f "$IMPL_PLAN" ]]; then
    echo "ERROR: plan.md not found in $FEATURE_DIR" >&2
    exit 1
fi
if $REQUIRE_TASKS && [[ ! -f "$TASKS" ]]; then
    echo "ERROR: tasks.md not found in $FEATURE_DIR" >&2
    exit 1
fi

docs=()
[[ -f "$RESEARCH" ]] && docs+=("research.md")
[[ -f "$DATA_MODEL" ]] && docs+=("data-model.md")
if [[ -d "$CONTRACTS_DIR" ]] && [[ -n "$(ls -A "$CONTRACTS_DIR" 2>/dev/null)" ]]; then
    docs+=("contracts/")
fi
[[ -f "$QUICKSTART" ]] && docs+=("quickstart.md")
if $INCLUDE_TASKS && [[ -f "$TASKS" ]]; then
    docs+=("tasks.md")
fi

if $JSON_MODE; then
    if has_jq; then
        json_docs=$(printf '%s\n' "${docs[@]}" | jq -R . | jq -s .) 2>/dev/null || json_docs="[]"
        jq -cn --arg feature_dir "$FEATURE_DIR" --argjson docs "$json_docs" \
            '{FEATURE_DIR:$feature_dir,AVAILABLE_DOCS:$docs}'
    else
        printf '{"FEATURE_DIR":"%s","AVAILABLE_DOCS":[]}\n' "$(json_escape "$FEATURE_DIR")"
    fi
else
    echo "FEATURE_DIR:$FEATURE_DIR"
    echo "AVAILABLE_DOCS:"
    check_file "$RESEARCH" "research.md"
    check_file "$DATA_MODEL" "data-model.md"
    check_dir "$CONTRACTS_DIR" "contracts/"
    check_file "$QUICKSTART" "quickstart.md"
    $INCLUDE_TASKS && check_file "$TASKS" "tasks.md"
fi
