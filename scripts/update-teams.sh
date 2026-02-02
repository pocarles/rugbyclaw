#!/usr/bin/env bash
# Fetches all teams for all leagues and saves to data/teams.json
# Run monthly via GitHub Action or manually

set -e

API_KEY="${THESPORTSDB_API_KEY:-1}"
OUTPUT_FILE="data/teams.json"

echo "Fetching teams from TheSportsDB API..."

# League definitions: "id:slug"
LEAGUES="
4430:top14
4414:premiership
4446:urc
5172:pro_d2
4550:champions_cup
5418:challenge_cup
4714:six_nations
4986:rugby_championship
4551:super_rugby
5069:currie_cup
5278:npc
5070:mlr
4574:rugby_world_cup
5563:womens_six_nations
"

# Start JSON output
echo "{" > "$OUTPUT_FILE"
echo '  "updated_at": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'",' >> "$OUTPUT_FILE"
echo '  "leagues": {' >> "$OUTPUT_FILE"

first=true
for league in $LEAGUES; do
  id=$(echo "$league" | cut -d: -f1)
  slug=$(echo "$league" | cut -d: -f2)

  [ -z "$id" ] && continue

  echo "  Fetching $slug (ID: $id)..."

  # Get teams from fixtures
  fixtures=$(curl -s "https://www.thesportsdb.com/api/v1/json/$API_KEY/eventsnextleague.php?id=$id")

  # Get teams from results
  results=$(curl -s "https://www.thesportsdb.com/api/v1/json/$API_KEY/eventspastleague.php?id=$id")

  # Extract unique teams from both
  teams=$(echo "$fixtures" "$results" | jq -s '
    [.[0].events[]?, .[1].events[]?] |
    map({id: .idHomeTeam, name: .strHomeTeam, badge: .strHomeTeamBadge}) +
    map({id: .idAwayTeam, name: .strAwayTeam, badge: .strAwayTeamBadge}) |
    unique_by(.id) |
    sort_by(.name) |
    map(select(.id != null))
  ')

  count=$(echo "$teams" | jq 'length')
  echo "    Found $count teams"

  if [ "$first" = true ]; then
    first=false
  else
    echo "," >> "$OUTPUT_FILE"
  fi

  printf '    "%s": %s' "$slug" "$teams" >> "$OUTPUT_FILE"

  # Rate limiting
  sleep 0.5
done

echo "" >> "$OUTPUT_FILE"
echo "  }" >> "$OUTPUT_FILE"
echo "}" >> "$OUTPUT_FILE"

echo ""
echo "Teams data saved to $OUTPUT_FILE"
