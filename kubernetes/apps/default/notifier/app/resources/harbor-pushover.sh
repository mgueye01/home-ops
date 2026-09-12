#!/usr/bin/env bash
set -euo pipefail

# Incoming arguments: Harbor webhook payload, Authorization header
PAYLOAD=${1:-}
AUTH_HEADER=${2:-}

# Required environment variables
: "${APPRISE_HARBOR_PUSHOVER_URL:?Pushover URL required}"
: "${HARBOR_NOTIFIER_TOKEN:?Harbor webhook token required}"
: "${HARBOR_API_USER:?Harbor read-only robot user required}"
: "${HARBOR_API_PASS:?Harbor read-only robot password required}"
HARBOR_API="https://harbor.g-eye.io/api/v2.0"

if [[ "${AUTH_HEADER}" != "${HARBOR_NOTIFIER_TOKEN}" ]]; then
    echo "[ERROR] Harbor webhook: bad or missing Authorization header" >&2
    exit 1
fi

echo "[DEBUG] Harbor Payload: ${PAYLOAD}"

function _jq() {
    jq -r "${1:?}" <<<"${PAYLOAD}"
}

function notify() {
    local event_type repo tag image critical high fixable total status
    event_type=$(_jq '.type')
    repo=$(_jq '.event_data.repository.repo_full_name')
    tag=$(_jq '.event_data.resources[0].tag // "untagged"')
    image="${repo}:${tag}"
    printf -v PUSHOVER_URL "https://harbor.g-eye.io/harbor/projects?q=%s" "$(_jq '.event_data.repository.namespace')"
    printf -v PUSHOVER_URL_TITLE "Open Harbor"

    case "${event_type}" in
        "SCANNING_COMPLETED")
            local ov='.event_data.resources[0].scan_overview["application/vnd.security.vulnerability.report; version=1.1"]'
            local project digest allowlist report allowed
            if [[ "$(_jq '.event_data.scan.scan_type // "vulnerability"')" != "vulnerability" ]]; then
                echo "[INFO] ${image}: not a vulnerability scan, ignoring"
                return 0
            fi
            critical=$(_jq "${ov}.summary.summary.Critical // 0")
            high=$(_jq "${ov}.summary.summary.High // 0")
            fixable=$(_jq "${ov}.summary.fixable // 0")
            total=$(_jq "${ov}.summary.total // 0")
            if [[ "${critical}" -eq 0 ]]; then
                echo "[INFO] ${image}: no critical CVE (high=${high}, total=${total}), not notifying"
                return 0
            fi
            # Harbor only applies the project CVE allowlist to its deployment check, never to
            # the scan summary in the webhook: subtract the allowlisted CVEs ourselves.
            project=$(_jq '.event_data.repository.namespace')
            digest=$(_jq '.event_data.resources[0].digest')
            allowlist=$(curl -sf -u "${HARBOR_API_USER}:${HARBOR_API_PASS}" "${HARBOR_API}/projects/${project}" \
                | jq -c '[.cve_allowlist.items[]?.cve_id]' || echo '[]')
            report=$(curl -sf -u "${HARBOR_API_USER}:${HARBOR_API_PASS}" \
                "${HARBOR_API}/projects/${project}/repositories/$(_jq '.event_data.repository.name')/artifacts/${digest}/additions/vulnerabilities" || true)
            if [[ -n "${report}" ]]; then
                # pipe, not a here-string: bash spools large here-strings to a temp file and / is read-only
                critical=$(printf '%s' "${report}" | jq -r --argjson allow "${allowlist}" \
                    '[.[] .vulnerabilities[] | select(.severity=="Critical") | .id] | unique | map(select(. as $c | $allow | index($c) | not)) | length')
            else
                echo "[WARN] ${image}: could not read the scan report from Harbor, using the raw critical count" >&2
            fi
            allowed=$(jq -r 'length' <<<"${allowlist}")
            if [[ "${critical}" -eq 0 ]]; then
                echo "[INFO] ${image}: every critical CVE is in the ${project} allowlist (${allowed} entries), not notifying"
                return 0
            fi
            printf -v PUSHOVER_TITLE "Harbor: %s critical CVE" "${critical}"
            printf -v PUSHOVER_MESSAGE "<b>%s</b><small>\n<b>Critical (not allowlisted):</b> %s  <b>High:</b> %s</small><small>\n<b>Fixable:</b> %s / %s</small>" \
                "${image}" "${critical}" "${high}" "${fixable}" "${total}"
            printf -v PUSHOVER_PRIORITY "high"
            ;;
        "SCANNING_FAILED"|"SCANNING_STOPPED")
            status=$(_jq '.event_data.resources[0].scan_overview[]?.scan_status // "unknown"')
            printf -v PUSHOVER_TITLE "Harbor: scan %s" "${event_type#SCANNING_}"
            printf -v PUSHOVER_MESSAGE "<b>%s</b><small>\nTrivy scan did not complete (status: %s)</small>" "${image}" "${status}"
            printf -v PUSHOVER_PRIORITY "normal"
            ;;
        *)
            echo "[ERROR] Unknown event type: ${event_type}" >&2
            return 1
            ;;
    esac

    apprise -vv --title "${PUSHOVER_TITLE}" --body "${PUSHOVER_MESSAGE}" --input-format html \
        "${APPRISE_HARBOR_PUSHOVER_URL}?url=${PUSHOVER_URL}&url_title=${PUSHOVER_URL_TITLE}&priority=${PUSHOVER_PRIORITY}&format=html"
}

function main() {
    notify
}

main "$@"
