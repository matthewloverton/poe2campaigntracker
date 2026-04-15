#!/bin/bash
# Simulates PoE2 Client.txt log output for testing the campaign tracker.
# Usage: ./scripts/simulate-game.sh [logfile]
# Default logfile: ./test-client.txt

LOGFILE="${1:-./test-client.txt}"
touch "$LOGFILE"
echo "Simulating game events to: $LOGFILE"
echo "Press Enter to advance through zones, or type 'q' to quit."
echo ""

# Simulated campaign progression (Act 1)
EVENTS=(
  # Initial character entry
  'INFO Client 1234] : TEST_CHARACTER is a level 1 Mercenary in the Fate of the Vaal league and is currently playing in The Riverbank.'
  # Zone: The Riverbank
  'DEBUG Client 1234] Generating level 1 area "G1_1" with seed 123456'
  # Enter town
  'DEBUG Client 1234] Generating level 15 area "G1_town" with seed 1'
  # Level up
  'INFO Client 1234] : TEST_CHARACTER (Mercenary) is now level 2'
  # Zone: Clearfell
  'DEBUG Client 1234] Generating level 2 area "G1_2" with seed 234567'
  # Level up
  'INFO Client 1234] : TEST_CHARACTER (Mercenary) is now level 3'
  # Zone: Mud Burrow
  'DEBUG Client 1234] Generating level 3 area "G1_3" with seed 345678'
  # Zone: The Grelwood
  'DEBUG Client 1234] Generating level 4 area "G1_4" with seed 456789'
  # Level up
  'INFO Client 1234] : TEST_CHARACTER (Mercenary) is now level 4'
  # Zone: The Red Vale
  'DEBUG Client 1234] Generating level 5 area "G1_5" with seed 567890'
  # Zone: The Grim Tangle
  'DEBUG Client 1234] Generating level 6 area "G1_6" with seed 678901'
  # Level up
  'INFO Client 1234] : TEST_CHARACTER (Mercenary) is now level 5'
  # Back to town
  'DEBUG Client 1234] Generating level 15 area "G1_town" with seed 1'
  # Level up
  'INFO Client 1234] : TEST_CHARACTER (Mercenary) is now level 6'
  # Cemetery of the Eternals
  'DEBUG Client 1234] Generating level 7 area "G1_7" with seed 789012'
  # Mausoleum of the Praetor
  'DEBUG Client 1234] Generating level 8 area "G1_8" with seed 890123'
  # Level up
  'INFO Client 1234] : TEST_CHARACTER (Mercenary) is now level 7'
  # Hunting Grounds
  'DEBUG Client 1234] Generating level 9 area "G1_11" with seed 901234'
  # Level up
  'INFO Client 1234] : TEST_CHARACTER (Mercenary) is now level 8'
  # Freythorn
  'DEBUG Client 1234] Generating level 10 area "G1_12" with seed 012345'
  # Level up
  'INFO Client 1234] : TEST_CHARACTER (Mercenary) is now level 9'
  # Ogham Farmlands
  'DEBUG Client 1234] Generating level 11 area "G1_13" with seed 112233'
  # Level up
  'INFO Client 1234] : TEST_CHARACTER (Mercenary) is now level 10'
  # Act 2 - Vastiri Outskirts
  'DEBUG Client 1234] Generating level 15 area "G2_1" with seed 223344'
  # Level up
  'INFO Client 1234] : TEST_CHARACTER (Mercenary) is now level 14'
)

STEP=0
for event in "${EVENTS[@]}"; do
  read -p "[Step $STEP] Press Enter to fire event... " input
  if [ "$input" = "q" ]; then
    echo "Stopped."
    exit 0
  fi
  TIMESTAMP=$(date '+%Y/%m/%d %H:%M:%S')
  echo "$TIMESTAMP 0000000000 00000000 [$event" >> "$LOGFILE"
  # Show a short description
  if echo "$event" | grep -q "Generating level"; then
    ZONE=$(echo "$event" | sed 's/.*area "\([^"]*\)".*/\1/')
    LEVEL=$(echo "$event" | sed 's/.*Generating level \([0-9]*\).*/\1/')
    echo "  -> Zone change: $ZONE (level $LEVEL)"
  elif echo "$event" | grep -q "is now level"; then
    LVL=$(echo "$event" | sed 's/.*is now level \([0-9]*\).*/\1/')
    echo "  -> Level up: $LVL"
  elif echo "$event" | grep -q "is a level"; then
    echo "  -> Character detected"
  fi
  STEP=$((STEP + 1))
done

echo "Simulation complete!"
