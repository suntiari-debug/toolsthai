#!/usr/bin/env bash
set -euo pipefail

BASE="${BASE:-http://127.0.0.1:3000}"
UA="Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"
PASS=0
FAIL=0

check_route() {
  local path="$1" needle="$2" title="$3"
  local response code html head body title_count og_title_count canonical_count
  response="$(curl -sS --compressed --max-time 15 --connect-timeout 5 "$BASE$path" -A "$UA" -w '__HTTP__%{http_code}')"
  code="${response##*__HTTP__}"
  html="${response%__HTTP__*}"
  head="${html%%</head>*}"
  body="$(printf '%s' "$html" | awk 'BEGIN{inside=0} /<div id="root">/{inside=1} inside{print} /window.__RQ_STATE__/{exit}')"
  title_count="$(printf '%s' "$head" | grep -o '<title>' | wc -l | tr -d ' ')"
  og_title_count="$(printf '%s' "$head" | grep -o 'property="og:title"' | wc -l | tr -d ' ')"
  canonical_count="$(printf '%s' "$head" | grep -o 'rel="canonical"' | wc -l | tr -d ' ')"

  if [ "$code" = "200" ] && [ "$title_count" = "1" ] && [ "$og_title_count" = "1" ] && [ "$canonical_count" = "1" ] && printf '%s' "$head" | grep -qF "$title" && printf '%s' "$head" | grep -qF "${path}\"" && printf '%s' "$head" | grep -qF 'application/ld+json' && printf '%s' "$body" | grep -qF "$needle"; then
    printf '[PASS] %s\n' "$path"
    PASS=$((PASS + 1))
  else
    printf '[FAIL] %s (status=%s title=%s og=%s canonical=%s)\n' "$path" "$code" "$title_count" "$og_title_count" "$canonical_count"
    FAIL=$((FAIL + 1))
  fi
}

check_route "/" "ออกใบเสนอราคา ใบแจ้งหนี้" "Tools Thai: สร้างใบเสนอราคา ใบแจ้งหนี้"
check_route "/quotation" "สร้างใบเสนอราคา PDF ฟรีใน 4 ขั้นตอน" "สร้างใบเสนอราคาออนไลน์ฟรี ไม่ต้องสมัคร"
check_route "/invoice" "สร้างใบแจ้งหนี้ PDF ฟรีใน 4 ขั้นตอน" "สร้างใบแจ้งหนี้ออนไลน์ฟรี ไม่ต้องสมัคร"

printf 'SSR verification: PASS=%s FAIL=%s\n' "$PASS" "$FAIL"
[ "$FAIL" = "0" ]
