"""Seed database with test data.

Creates:
  - 1 admin  (admin@fieldwatch.com / admin123456)
  - 2 managers (manager1@fieldwatch.com, manager2@fieldwatch.com / manager123456)
  - 3 reporters (reporter1-3@fieldwatch.com / reporter123456)
  - 15-20 sample reports around Tampere (61.48-61.52 lat, 23.75-23.85 lng)
"""

import asyncio
import random
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import settings
from app.core.security import hash_password
from app.models.report import Priority, Report, ReportStatus
from app.models.user import User, UserRole

engine = create_async_engine(settings.database_url)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)

TAMPERE_COORDS = [
    (61.4978, 23.7610, "Tampere Central Station area"),
    (61.5000, 23.7800, "Tammerkoski riverside"),
    (61.5022, 23.7730, "Näsilinna district"),
    (61.4882, 23.7721, "Tampere Market Hall area"),
    (61.4940, 23.7850, "Kalevan kirkko"),
    (61.5100, 23.7600, "Pispala district"),
    (61.4820, 23.7560, "Ratina stadium"),
    (61.5050, 23.8000, "Hervanta road"),
    (61.4960, 23.7690, "Tampere University area"),
    (61.5150, 23.7800, "Tesoma neighborhood"),
    (61.4900, 23.8100, "Nekala industrial"),
    (61.4850, 23.7900, "Peltolammi road"),
    (61.5080, 23.7500, "Lapinniemi park"),
    (61.5010, 23.7650, "Finlayson area"),
    (61.4920, 23.7750, "Amuri district"),
    (61.4870, 23.8050, "Multisilta"),
    (61.5200, 23.7700, "Lielahti"),
    (61.4800, 23.7700, "Hervanta south"),
    (61.5060, 23.8150, "Ruotula"),
    (61.4950, 23.7550, "Särkänniemi area"),
]

REPORT_TEMPLATES = [
    ("Broken street light on main road", "The street light has been out for two weeks making the area unsafe at night.", Priority.HIGH),
    ("Pothole on pedestrian path", "Large pothole near the entrance causing trip hazard for pedestrians.", Priority.MEDIUM),
    ("Graffiti on public building wall", "Graffiti tags appeared overnight on the east wall of the building.", Priority.LOW),
    ("Water leak from underground pipe", "Water is pooling on the street surface indicating a subsurface pipe leak.", Priority.CRITICAL),
    ("Damaged guardrail on bridge", "Section of guardrail is bent and partially detached after vehicle impact.", Priority.HIGH),
    ("Illegal dumping at roadside", "Large amounts of construction waste dumped illegally in the forest area.", Priority.MEDIUM),
    ("Broken bench in public park", "Park bench has cracked wood and exposed nails — safety risk.", Priority.LOW),
    ("Flooding in underpass", "Underpass completely flooded after rain, impassable for pedestrians.", Priority.CRITICAL),
    ("Faulty traffic signal", "Traffic light stuck on red during off-peak hours causing congestion.", Priority.HIGH),
    ("Tree fallen across path", "Large tree fell across the cycling path blocking access.", Priority.HIGH),
    ("Overflowing public bin", "Waste bin overflowing for several days causing hygiene issues.", Priority.LOW),
    ("Cracked road surface", "Road surface has cracked and subsided, creating an uneven hazard.", Priority.MEDIUM),
    ("Broken playground equipment", "Slide structure has broken fasteners and sharp edges exposed.", Priority.CRITICAL),
    ("Oil spill on road", "Diesel or oil spill on road surface near the loading bay exit.", Priority.HIGH),
    ("Missing road sign", "Speed limit sign missing at the junction — removed or stolen.", Priority.MEDIUM),
    ("Blocked drain causing flooding", "Drain blocked with leaves and debris, causing surface flooding.", Priority.MEDIUM),
    ("Damaged electrical box", "Electrical distribution box door is open and wiring exposed.", Priority.CRITICAL),
    ("Fence damage at perimeter", "Perimeter fence damaged, creating a gap accessible to the public.", Priority.LOW),
    ("Gritting needed on path", "Icy pedestrian path hasn't been gritted — multiple near-falls reported.", Priority.HIGH),
    ("Abandoned vehicle blocking access", "Vehicle abandoned for over a week blocking fire access lane.", Priority.MEDIUM),
]

STATUSES_WEIGHTED = [
    ReportStatus.SUBMITTED,
    ReportStatus.SUBMITTED,
    ReportStatus.SUBMITTED,
    ReportStatus.IN_REVIEW,
    ReportStatus.IN_REVIEW,
    ReportStatus.RESOLVED,
    ReportStatus.REJECTED,
    ReportStatus.DRAFT,
]

MANAGER_NOTES = [
    "Dispatched maintenance team. ETA 48 hours.",
    "Under investigation. Will update once assessed.",
    "Fixed. Confirmed by site inspection on follow-up visit.",
    "Duplicate report — merged with existing ticket.",
    "Escalated to city infrastructure department.",
    None,
    None,
    None,
]


async def get_or_create_user(
    db: AsyncSession,
    email: str,
    full_name: str,
    password: str,
    role: UserRole,
) -> User:
    result = await db.execute(select(User).where(User.email == email))
    existing = result.scalar_one_or_none()
    if existing:
        return existing
    user = User(
        email=email,
        hashed_password=hash_password(password),
        full_name=full_name,
        role=role,
    )
    db.add(user)
    await db.flush()
    return user


async def seed() -> None:
    print("Seeding database...")

    async with AsyncSessionLocal() as db:
        # --- Users ---
        admin = await get_or_create_user(
            db, "admin@fieldwatch.com", "Admin User", "admin123456", UserRole.ADMIN
        )
        manager1 = await get_or_create_user(
            db, "manager1@fieldwatch.com", "Anna Mäkinen", "manager123456", UserRole.MANAGER
        )
        manager2 = await get_or_create_user(
            db, "manager2@fieldwatch.com", "Juhani Korhonen", "manager123456", UserRole.MANAGER
        )
        reporter1 = await get_or_create_user(
            db, "reporter1@fieldwatch.com", "Mikko Virtanen", "reporter123456", UserRole.REPORTER
        )
        reporter2 = await get_or_create_user(
            db, "reporter2@fieldwatch.com", "Liisa Järvinen", "reporter123456", UserRole.REPORTER
        )
        reporter3 = await get_or_create_user(
            db, "reporter3@fieldwatch.com", "Pekka Leinonen", "reporter123456", UserRole.REPORTER
        )

        await db.commit()

        reporters = [reporter1, reporter2, reporter3]
        managers = [manager1, manager2]

        print(f"  admin:     {admin.email}")
        print(f"  manager1:  {manager1.email}")
        print(f"  manager2:  {manager2.email}")
        print(f"  reporter1: {reporter1.email}")
        print(f"  reporter2: {reporter2.email}")
        print(f"  reporter3: {reporter3.email}")

        # --- Reports ---
        now = datetime.now(timezone.utc)
        created_count = 0

        for i, (title, description, priority) in enumerate(REPORT_TEMPLATES):
            lat, lng, address_hint = TAMPERE_COORDS[i % len(TAMPERE_COORDS)]
            reporter = reporters[i % len(reporters)]
            status = STATUSES_WEIGHTED[i % len(STATUSES_WEIGHTED)]
            manager_note = MANAGER_NOTES[i % len(MANAGER_NOTES)]

            assigned_to_id = None
            if status in (ReportStatus.IN_REVIEW, ReportStatus.RESOLVED):
                assigned_to_id = managers[i % len(managers)].id

            created_at = now - timedelta(hours=random.randint(1, 72 * 7))

            report = Report(
                title=title,
                description=description,
                priority=priority,
                status=status,
                latitude=lat + random.uniform(-0.002, 0.002),
                longitude=lng + random.uniform(-0.005, 0.005),
                address=f"{address_hint}, Tampere",
                reporter_id=reporter.id,
                assigned_to_id=assigned_to_id,
                manager_note=manager_note if status != ReportStatus.SUBMITTED else None,
                created_at=created_at,
                updated_at=created_at + timedelta(hours=random.randint(0, 24)),
            )
            db.add(report)
            created_count += 1

        await db.commit()
        print(f"  {created_count} reports created")

    print("Seed complete.")
    print()
    print("Login credentials:")
    print("  admin@fieldwatch.com      / admin123456")
    print("  manager1@fieldwatch.com   / manager123456")
    print("  manager2@fieldwatch.com   / manager123456")
    print("  reporter1@fieldwatch.com  / reporter123456")
    print("  reporter2@fieldwatch.com  / reporter123456")
    print("  reporter3@fieldwatch.com  / reporter123456")


if __name__ == "__main__":
    asyncio.run(seed())
