#!/usr/bin/env bash
set -euo pipefail

# Incoming arguments
PAYLOAD=${1:-}

# Required environment variables
: "${APPRISE_JELLYSEERR_PUSHOVER_URL:?Pushover URL required}"

echo "[DEBUG] Jellyseerr Payload: ${PAYLOAD}"

function _jq() {
    jq -r "${1:?}" <<<"${PAYLOAD}"
}

function notify() {
    local event_type=$(_jq '.notification_type')
    local media_type=$(_jq '.media.media_type')
    local subject=$(_jq '.subject')
    local message=$(_jq '.message')
    local tmdb_id=$(_jq '.media.tmdbId')

    case "${event_type}" in
        "MEDIA_AVAILABLE")
            printf -v PUSHOVER_TITLE "%s Available" \
                "$( [[ "${media_type}" == "movie" ]] && echo "Movie" || echo "Series" )"
            printf -v PUSHOVER_MESSAGE "<b>%s</b><small>\n%s</small>" \
                "${subject}" "${message}"
            printf -v PUSHOVER_URL "https://requests.g-eye.io/%s/%s" \
                "${media_type}" "${tmdb_id}"
            printf -v PUSHOVER_URL_TITLE "View in Jellyseerr"
            printf -v PUSHOVER_PRIORITY "low"
            ;;
        "MEDIA_AUTO_APPROVED"|"MEDIA_APPROVED")
            printf -v PUSHOVER_TITLE "%s Request Approved" \
                "$( [[ "${media_type}" == "movie" ]] && echo "Movie" || echo "Series" )"
            printf -v PUSHOVER_MESSAGE "<b>%s</b><small>\n%s</small>" \
                "${subject}" "${message}"
            printf -v PUSHOVER_URL "https://requests.g-eye.io/%s/%s" \
                "${media_type}" "${tmdb_id}"
            printf -v PUSHOVER_URL_TITLE "View in Jellyseerr"
            printf -v PUSHOVER_PRIORITY "low"
            ;;
        "MEDIA_PENDING")
            printf -v PUSHOVER_TITLE "New %s Request" \
                "$( [[ "${media_type}" == "movie" ]] && echo "Movie" || echo "Series" )"
            printf -v PUSHOVER_MESSAGE "<b>%s</b><small>\n%s</small>" \
                "${subject}" "${message}"
            printf -v PUSHOVER_URL "https://requests.g-eye.io/%s/%s" \
                "${media_type}" "${tmdb_id}"
            printf -v PUSHOVER_URL_TITLE "View Request"
            printf -v PUSHOVER_PRIORITY "normal"
            ;;
        "MEDIA_DECLINED")
            printf -v PUSHOVER_TITLE "%s Request Declined" \
                "$( [[ "${media_type}" == "movie" ]] && echo "Movie" || echo "Series" )"
            printf -v PUSHOVER_MESSAGE "<b>%s</b>" "${subject}"
            printf -v PUSHOVER_URL "https://requests.g-eye.io/%s/%s" \
                "${media_type}" "${tmdb_id}"
            printf -v PUSHOVER_URL_TITLE "View in Jellyseerr"
            printf -v PUSHOVER_PRIORITY "low"
            ;;
        "MEDIA_FAILED")
            printf -v PUSHOVER_TITLE "%s Download Failed" \
                "$( [[ "${media_type}" == "movie" ]] && echo "Movie" || echo "Series" )"
            printf -v PUSHOVER_MESSAGE "<b>%s</b><small>\n%s</small>" \
                "${subject}" "${message}"
            printf -v PUSHOVER_URL "https://requests.g-eye.io/%s/%s" \
                "${media_type}" "${tmdb_id}"
            printf -v PUSHOVER_URL_TITLE "View in Jellyseerr"
            printf -v PUSHOVER_PRIORITY "high"
            ;;
        "TEST_NOTIFICATION")
            printf -v PUSHOVER_TITLE "Test Notification"
            printf -v PUSHOVER_MESSAGE "Howdy this is a test notification from <b>%s</b>" "Jellyseerr"
            printf -v PUSHOVER_URL "%s" "https://requests.g-eye.io"
            printf -v PUSHOVER_URL_TITLE "Open Jellyseerr"
            printf -v PUSHOVER_PRIORITY "low"
            ;;
        *)
            echo "[ERROR] Unknown event type: ${event_type}" >&2
            return 1
            ;;
    esac

    apprise -vv --title "${PUSHOVER_TITLE}" --body "${PUSHOVER_MESSAGE}" --input-format html \
        "${APPRISE_JELLYSEERR_PUSHOVER_URL}?url=${PUSHOVER_URL}&url_title=${PUSHOVER_URL_TITLE}&priority=${PUSHOVER_PRIORITY}&format=html"
}

function main() {
    notify
}

main "$@"
