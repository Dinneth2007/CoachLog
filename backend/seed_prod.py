#!/usr/bin/env python3
"""Generate a self-contained seed_prod.sql for a FRESH prod DB (schema + 30 drills
already created by Flyway). Creates the demo coach + full demo dataset.
Dimensions are written UPPERCASE to match the TechniqueDimension enum."""
import hashlib, random, uuid, datetime

random.seed(42)
BCRYPT = "$2a$10$CQqzuyXQoL2lawSvw.DH9uMts7ZnMyjhMY8DnJw859EqAK0lN4JMG"  # = "password"
PID = 1000; SID = 1000; OID = 10000; RID = 1000; TKID = 1000

DIMS = {
    "BATTING": ["stance", "footwork", "bat_path", "timing", "shot_selection"],
    "BOWLING": ["action", "line", "length", "variations", "control"],
    "FIELDING": ["catching", "throwing", "positioning", "agility"],
    "MATCH_AWARENESS": ["decision_making", "communication", "pressure_response"],
}

PLAYERS = [
    ("Harry Thompson", "U11", "BATTING", "FIELDING", 3.2, 0.12),
    ("Oscar Bennett",  "U11", "BOWLING", "BATTING", 2.6, 0.18),
    ("Leo Mitchell",   "U11", "FIELDING","MATCH_AWARENESS", 3.0, 0.10),
    ("Noah Carter",    "U11", "BATTING", "BOWLING", 2.2, -0.10),
    ("Finlay Reed",    "U11", "MATCH_AWARENESS","BATTING", 3.4, 0.08),
    ("Jacob Hughes",   "U11", "BOWLING", "FIELDING", 1.9, 0.05),
    ("Ethan Walsh",    "U13", "BATTING", "MATCH_AWARENESS", 3.6, 0.14),
    ("Mason Clarke",   "U13", "BOWLING", "BATTING", 3.1, 0.16),
    ("Charlie Ward",   "U13", "FIELDING","BOWLING", 2.8, -0.12),
    ("Dylan Foster",   "U13", "BATTING", "FIELDING", 2.4, 0.20),
    ("Riley Morgan",   "U13", "MATCH_AWARENESS","BOWLING", 3.3, 0.09),
    ("Samuel Price",   "U13", "BOWLING", "MATCH_AWARENESS", 2.0, 0.04),
    ("Lucas Grant",    "U15", "BATTING", "BOWLING", 3.8, 0.10),
    ("Daniel Cooper",  "U15", "BOWLING", "FIELDING", 3.5, 0.13),
    ("Adam Fletcher",  "U15", "FIELDING","BATTING", 3.0, -0.11),
    ("Joseph Lane",    "U15", "BATTING", "MATCH_AWARENESS", 4.0, 0.06),
    ("Nathan Brooks",  "U15", "MATCH_AWARENESS","FIELDING", 3.4, 0.12),
    ("Toby Richardson","U15", "BOWLING", "BATTING", 2.7, 0.15),
]

SESSION_DATES = [datetime.date(2026, 4, 18) + datetime.timedelta(weeks=w) for w in range(8)]
SESSION_TITLES = [
    "Pre-season fitness & basics", "Batting technique focus", "Bowling line & length",
    "Fielding drills & catching", "Match scenario practice", "Spin & pace adaptation",
    "Power hitting & running", "Mini-match & review",
]
SESSION_NOTES = [
    "Good turnout. Focused on fundamentals after the winter break.",
    "Net session emphasising front-foot play and shot selection.",
    "Worked on consistency at the crease end. Several seamers improving.",
    "High and flat catching circuits plus throwing accuracy.",
    "Simulated middle-overs pressure with field restrictions.",
    "Players rotated against spin and pace bowling machines.",
    "Boundary hitting and quick singles between the wickets.",
    "Intra-squad mini match followed by individual feedback.",
]
DIM_NOTE = {1: "Needs significant work — revisit fundamentals.",
            2: "Inconsistent; struggling under match tempo.",
            3: "Solid baseline, room to refine.",
            4: "Strong and repeatable.",
            5: "Excellent — a real standout."}

def clamp(x): return max(1, min(5, int(round(x))))
def esc(s): return s.replace("'", "''")

sql = ["-- Crick prod demo seed. Run ONCE against a fresh DB.",
       "START TRANSACTION;",
       f"INSERT INTO users (email,password_hash,name,role,created_at) "
       f"VALUES ('demo@crick.app','{BCRYPT}','Alex Rivera','COACH','2026-04-15 08:00:00');",
       "SET @c := LAST_INSERT_ID();"]

ids = {}
for i, (name, ag, prim, weak, base, slope) in enumerate(PLAYERS):
    pid = PID + i; ids[name] = (pid, ag, prim, weak, base, slope)
    note = f"{ag} squad. Works on {weak.lower().replace('_',' ')}."
    sql.append(f"INSERT INTO players (id,name,age_group,notes,coach_id,created_at) VALUES "
               f"({pid},'{esc(name)}','{ag}','{esc(note)}',@c,'2026-04-15 09:00:00');")

oid = OID
recs_data = {}
for s, sdate in enumerate(SESSION_DATES):
    sid = SID + s
    sql.append(f"INSERT INTO sessions (id,coach_id,date,title,notes,created_at) VALUES "
               f"({sid},@c,'{sdate.isoformat()}','{esc(SESSION_TITLES[s])}','{esc(SESSION_NOTES[s])}','{sdate} 18:00:00');")
    attendees = random.sample(list(ids), random.randint(13, 16))
    for name in attendees:
        pid, ag, prim, weak, base, slope = ids[name]
        sql.append(f"INSERT INTO session_players (session_id,player_id) VALUES ({sid},{pid});")
        overall = f"{name.split()[0]} engaged well; focus area remains {weak.lower().replace('_',' ')}."
        sql.append(f"INSERT INTO player_observations (id,session_id,player_id,overall_notes,created_at) VALUES "
                   f"({oid},{sid},{pid},'{esc(overall)}','{sdate} 18:30:00');")
        latest = []
        for cat in (prim, weak):
            offset = 0.0 if cat == prim else -1.1
            for dim in DIMS[cat]:
                sc = clamp(base + offset + slope * s + random.uniform(-0.5, 0.5))
                sql.append(f"INSERT INTO technique_scores (observation_id,category,dimension,score,notes,created_at) "
                           f"VALUES ({oid},'{cat}','{dim.upper()}',{sc},'{esc(DIM_NOTE[sc])}','{sdate} 18:30:00');")
                latest.append((cat, dim, sc))
        recs_data[name] = latest
        oid += 1

DRILLS_BY_CAT = {
    "BATTING": [(1,8,17),(2,8,17),(3,11,17),(4,13,17),(5,8,17),(6,11,17),(7,13,18),(8,8,17),(9,13,18),(10,14,18)],
    "BOWLING": [(11,8,17),(12,8,17),(13,11,17),(14,14,18),(15,13,17),(16,14,18),(17,14,18),(18,8,17),(19,13,17),(20,14,18)],
    "FIELDING": [(21,8,17),(22,11,17),(23,8,17),(24,11,17),(25,13,18)],
    "MATCH_AWARENESS": [(26,8,17),(27,14,18),(28,13,17),(29,11,17),(30,13,18)],
}
AGE_NUM = {"U11": 11, "U13": 13, "U15": 15}
rid = RID
for name in ["Noah Carter", "Jacob Hughes", "Charlie Ward", "Samuel Price", "Dylan Foster"]:
    pid, ag, prim, weak, base, slope = ids[name]
    age = AGE_NUM[ag]
    weakdims = sorted([(d, sc) for (c, d, sc) in recs_data[name] if c == weak], key=lambda x: x[1])
    cands = [d for d in DRILLS_BY_CAT[weak] if d[1] <= age <= d[2]]
    random.shuffle(cands)
    for j, (did, _, _) in enumerate(cands[:3]):
        dim, sc = weakdims[j % len(weakdims)]
        rat = (f"Recent sessions show {dim.replace('_',' ')} scoring around {sc}/5 in "
               f"{weak.lower().replace('_',' ')}. This drill isolates that movement and builds repeatable habits.")
        exp = (f"Expect {name.split()[0]} to gain noticeably more control within 3-4 sessions, "
               f"lifting {dim.replace('_',' ')} toward a solid 4/5.")
        sim = round(random.uniform(0.78, 0.94), 3)
        sql.append(f"INSERT INTO drill_recommendations (id,player_id,drill_id,rationale,expected_outcome,similarity_score,is_current,generated_at,created_at) "
                   f"VALUES ({rid},{pid},{did},'{esc(rat)}','{esc(exp)}',{sim},1,'2026-06-08 10:00:00','2026-06-08 10:00:00');")
        rid += 1

tkid = TKID
parent_links = []
for name in ["Ethan Walsh", "Lucas Grant"]:
    pid = ids[name][0]
    raw = str(uuid.uuid4())
    h = hashlib.sha256(raw.encode()).hexdigest()
    sql.append(f"INSERT INTO parent_access_tokens (id,player_id,token_hash,expires_at,created_at) "
               f"VALUES ({tkid},{pid},'{h}','2026-07-14 09:00:00','2026-06-14 09:00:00');")
    parent_links.append((name, raw)); tkid += 1

sql.append("COMMIT;")
with open("seed_prod.sql", "w") as f:
    f.write("\n".join(sql) + "\n")

print("WROTE seed_prod.sql")
print("\n=== PARENT LINKS (append your frontend origin) ===")
for name, raw in parent_links:
    print(f"  {name}: <FRONTEND_URL>/parent/{raw}")
