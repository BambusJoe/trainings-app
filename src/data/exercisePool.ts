/**
 * Eingebauter Übungs-Pool. Einträge landen erst in der Datenbank, wenn sie zum ersten Mal
 * genutzt werden. `aliases` enthält englische Namen (u. a. wie Hevy sie exportiert),
 * damit die Suche auch englisch funktioniert und der Hevy-Import keine Dubletten erzeugt.
 */

export const MUSCLES = ['Brust', 'Rücken', 'Schultern', 'Bizeps', 'Trizeps', 'Beine', 'Po', 'Waden', 'Bauch'] as const
export type Muscle = (typeof MUSCLES)[number]

export interface PoolExercise {
  name: string
  muscle: Muscle
  aliases: string[]
}

const e = (name: string, muscle: Muscle, ...aliases: string[]): PoolExercise => ({ name, muscle, aliases })

export const EXERCISE_POOL: PoolExercise[] = [
  // Brust
  e('Bankdrücken (Langhantel)', 'Brust', 'Bench Press (Barbell)', 'Flachbankdrücken'),
  e('Bankdrücken (Kurzhantel)', 'Brust', 'Bench Press (Dumbbell)'),
  e('Bankdrücken (Smith-Maschine)', 'Brust', 'Bench Press (Smith Machine)'),
  e('Schrägbankdrücken (Langhantel)', 'Brust', 'Incline Bench Press (Barbell)'),
  e('Schrägbankdrücken (Kurzhantel)', 'Brust', 'Incline Bench Press (Dumbbell)'),
  e('Schrägbankdrücken (Smith-Maschine)', 'Brust', 'Incline Bench Press (Smith Machine)'),
  e('Negativbankdrücken (Langhantel)', 'Brust', 'Decline Bench Press (Barbell)'),
  e('Brustpresse (Maschine)', 'Brust', 'Chest Press (Machine)'),
  e('Schrägbank-Brustpresse (Maschine)', 'Brust', 'Incline Chest Press (Machine)'),
  e('Butterfly (Maschine)', 'Brust', 'Butterfly (Pec Deck)', 'Pec Deck', 'Chest Fly (Machine)'),
  e('Fliegende (Kurzhantel)', 'Brust', 'Chest Fly (Dumbbell)'),
  e('Kabelzug-Crossover', 'Brust', 'Cable Fly Crossovers', 'Cable Crossover', 'Chest Fly (Cable)'),
  e('Liegestütze', 'Brust', 'Push Up', 'Pushups'),
  e('Dips (Brust)', 'Brust', 'Chest Dip'),

  // Rücken
  e('Klimmzüge', 'Rücken', 'Pull Up', 'Pullups'),
  e('Klimmzüge (Untergriff)', 'Rücken', 'Chin Up', 'Chinups'),
  e('Klimmzüge (assistiert)', 'Rücken', 'Pull Up (Assisted)', 'Assisted Pull Up'),
  e('Latzug (breit)', 'Rücken', 'Lat Pulldown (Cable)', 'Lat Pulldown (Machine)', 'Lat Pulldown'),
  e('Latzug (eng)', 'Rücken', 'Lat Pulldown - Close Grip (Cable)', 'Close Grip Lat Pulldown'),
  e('Rudern vorgebeugt (Langhantel)', 'Rücken', 'Bent Over Row (Barbell)', 'Barbell Row'),
  e('Rudern einarmig (Kurzhantel)', 'Rücken', 'Dumbbell Row', 'Single Arm Dumbbell Row'),
  e('Rudern am Kabel (sitzend)', 'Rücken', 'Seated Cable Row - V Grip (Cable)', 'Seated Cable Row - Bar Grip', 'Seated Row (Cable)'),
  e('Rudermaschine', 'Rücken', 'Seated Row (Machine)', 'Iso-Lateral Row (Machine)'),
  e('T-Bar-Rudern', 'Rücken', 'T Bar Row'),
  e('Kreuzheben (Langhantel)', 'Rücken', 'Deadlift (Barbell)', 'Deadlift'),
  e('Rumänisches Kreuzheben (Langhantel)', 'Rücken', 'Romanian Deadlift (Barbell)', 'RDL'),
  e('Rumänisches Kreuzheben (Kurzhantel)', 'Rücken', 'Romanian Deadlift (Dumbbell)'),
  e('Rückenstrecker (Hyperextension)', 'Rücken', 'Back Extension (Hyperextension)', 'Hyperextension', 'Back Extension (Machine)'),
  e('Überzüge am Kabel (gestreckte Arme)', 'Rücken', 'Straight Arm Lat Pulldown (Cable)', 'Cable Pullover'),
  e('Shrugs (Kurzhantel)', 'Rücken', 'Shrug (Dumbbell)'),
  e('Shrugs (Langhantel)', 'Rücken', 'Shrug (Barbell)'),

  // Schultern
  e('Schulterdrücken (Langhantel)', 'Schultern', 'Overhead Press (Barbell)', 'Military Press', 'OHP'),
  e('Schulterdrücken (Kurzhantel)', 'Schultern', 'Shoulder Press (Dumbbell)', 'Seated Shoulder Press (Dumbbell)'),
  e('Schulterpresse (Maschine)', 'Schultern', 'Shoulder Press (Machine)', 'Shoulder Press (Machine Plates)'),
  e('Arnold Press', 'Schultern', 'Arnold Press (Dumbbell)'),
  e('Seitheben (Kurzhantel)', 'Schultern', 'Lateral Raise (Dumbbell)'),
  e('Seitheben am Kabel', 'Schultern', 'Lateral Raise (Cable)', 'Single Arm Lateral Raise (Cable)'),
  e('Seitheben (Maschine)', 'Schultern', 'Lateral Raise (Machine)'),
  e('Frontheben (Kurzhantel)', 'Schultern', 'Front Raise (Dumbbell)'),
  e('Reverse Butterfly (Maschine)', 'Schultern', 'Rear Delt Reverse Fly (Machine)', 'Reverse Fly'),
  e('Reverse Flys (Kurzhantel)', 'Schultern', 'Rear Delt Reverse Fly (Dumbbell)'),
  e('Face Pulls', 'Schultern', 'Face Pull'),
  e('Aufrechtes Rudern', 'Schultern', 'Upright Row (Barbell)', 'Upright Row (Cable)'),

  // Bizeps
  e('Bizepscurls (Langhantel)', 'Bizeps', 'Bicep Curl (Barbell)', 'Barbell Curl'),
  e('Bizepscurls (SZ-Stange)', 'Bizeps', 'EZ Bar Biceps Curl', 'Bicep Curl (EZ Bar)'),
  e('Bizepscurls (Kurzhantel)', 'Bizeps', 'Bicep Curl (Dumbbell)', 'Dumbbell Curl'),
  e('Bizepscurls am Kabel', 'Bizeps', 'Bicep Curl (Cable)', 'Cable Curl'),
  e('Bizepscurls (Maschine)', 'Bizeps', 'Bicep Curl (Machine)'),
  e('Hammercurls', 'Bizeps', 'Hammer Curl (Dumbbell)', 'Hammer Curl (Cable)'),
  e('Scottcurls', 'Bizeps', 'Preacher Curl (Barbell)', 'Preacher Curl (Machine)', 'Preacher Curl (Dumbbell)'),
  e('Schrägbank-Curls', 'Bizeps', 'Seated Incline Curl (Dumbbell)', 'Incline Curl'),
  e('Konzentrationscurls', 'Bizeps', 'Concentration Curl'),

  // Trizeps
  e('Trizepsdrücken am Kabel (Stange)', 'Trizeps', 'Triceps Pushdown', 'Tricep Pushdown'),
  e('Trizepsdrücken am Kabel (Seil)', 'Trizeps', 'Triceps Rope Pushdown', 'Rope Pushdown'),
  e('French Press (SZ-Stange)', 'Trizeps', 'Skullcrusher (Barbell)', 'Skullcrusher (EZ Bar)', 'Skull Crusher'),
  e('French Press (Kurzhantel)', 'Trizeps', 'Skullcrusher (Dumbbell)'),
  e('Trizepsstrecken über Kopf (Kabel)', 'Trizeps', 'Overhead Triceps Extension (Cable)'),
  e('Trizepsstrecken über Kopf (Kurzhantel)', 'Trizeps', 'Overhead Triceps Extension (Dumbbell)', 'Triceps Extension (Dumbbell)'),
  e('Dips', 'Trizeps', 'Triceps Dip', 'Bench Dip'),
  e('Enges Bankdrücken', 'Trizeps', 'Bench Press - Close Grip (Barbell)', 'Close Grip Bench Press'),
  e('Trizeps-Kickbacks', 'Trizeps', 'Triceps Kickback (Dumbbell)', 'Triceps Kickback (Cable)'),
  e('Trizeps-Dips (Maschine)', 'Trizeps', 'Seated Dip Machine', 'Triceps Dip (Machine)'),

  // Beine
  e('Kniebeuge (Langhantel)', 'Beine', 'Squat (Barbell)', 'Back Squat', 'Squat'),
  e('Frontkniebeuge', 'Beine', 'Front Squat (Barbell)', 'Front Squat'),
  e('Kniebeuge (Smith-Maschine)', 'Beine', 'Squat (Smith Machine)'),
  e('Goblet Squat', 'Beine', 'Goblet Squat (Dumbbell)', 'Goblet Squat (Kettlebell)'),
  e('Beinpresse', 'Beine', 'Leg Press (Machine)', 'Leg Press'),
  e('Hackenschmidt-Kniebeuge', 'Beine', 'Hack Squat (Machine)', 'Hack Squat'),
  e('Ausfallschritte (Kurzhantel)', 'Beine', 'Lunge (Dumbbell)', 'Walking Lunge (Dumbbell)'),
  e('Ausfallschritte (Langhantel)', 'Beine', 'Lunge (Barbell)'),
  e('Bulgarian Split Squat', 'Beine', 'Bulgarian Split Squat (Dumbbell)', 'Bulgarian Split Squat'),
  e('Beinstrecker', 'Beine', 'Leg Extension (Machine)', 'Leg Extension'),
  e('Beinbeuger (liegend)', 'Beine', 'Lying Leg Curl (Machine)', 'Lying Leg Curl'),
  e('Beinbeuger (sitzend)', 'Beine', 'Seated Leg Curl (Machine)', 'Seated Leg Curl'),
  e('Adduktoren (Maschine)', 'Beine', 'Hip Adduction (Machine)'),
  e('Abduktoren (Maschine)', 'Beine', 'Hip Abduction (Machine)'),

  // Po
  e('Hip Thrust (Langhantel)', 'Po', 'Hip Thrust (Barbell)', 'Hip Thrust'),
  e('Hip Thrust (Maschine)', 'Po', 'Hip Thrust (Machine)'),
  e('Glute Bridge', 'Po', 'Glute Bridge'),
  e('Glute Kickback (Kabel)', 'Po', 'Glute Kickback (Cable)', 'Glute Kickback (Machine)'),

  // Waden
  e('Wadenheben (stehend)', 'Waden', 'Standing Calf Raise', 'Standing Calf Raise (Machine)', 'Calf Raise'),
  e('Wadenheben (sitzend)', 'Waden', 'Seated Calf Raise', 'Seated Calf Raise (Machine)'),
  e('Wadenheben an der Beinpresse', 'Waden', 'Calf Press (Machine)', 'Calf Press on Leg Press'),

  // Bauch
  e('Crunches', 'Bauch', 'Crunch'),
  e('Crunches am Kabel', 'Bauch', 'Cable Crunch'),
  e('Bauchmaschine', 'Bauch', 'Crunch (Machine)', 'Ab Crunch (Machine)'),
  e('Beinheben (hängend)', 'Bauch', 'Hanging Leg Raise', 'Hanging Knee Raise'),
  e('Beinheben (liegend)', 'Bauch', 'Lying Leg Raise', 'Leg Raise'),
  e('Russian Twist', 'Bauch', 'Russian Twist'),
  e('Ab Wheel', 'Bauch', 'Ab Wheel', 'Ab Rollout'),
]

const byKey = new Map<string, PoolExercise>()
for (const p of EXERCISE_POOL) {
  byKey.set(p.name.toLowerCase(), p)
  for (const a of p.aliases) if (!byKey.has(a.toLowerCase())) byKey.set(a.toLowerCase(), p)
}

/** Pool-Eintrag zu einem deutschen Namen oder englischen Alias. */
export function findPoolEntry(name: string): PoolExercise | undefined {
  return byKey.get(name.trim().toLowerCase())
}

/** Normalisiert für die Suche: Kleinschreibung, Umlaute, Bindestriche. */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[-()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Alle Suchwörter müssen in Name oder einem Alias vorkommen ("bank kurz" findet "Bankdrücken (Kurzhantel)"). */
export function matchesQuery(query: string, name: string, aliases: string[] = []): boolean {
  const words = normalize(query).split(' ').filter(Boolean)
  if (words.length === 0) return true
  const hay = [name, ...aliases].map(normalize)
  return hay.some((h) => words.every((w) => h.includes(w)))
}
