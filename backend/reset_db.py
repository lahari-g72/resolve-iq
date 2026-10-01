from database import engine
import models

print("Dropping old ticket and user tables...")
# Drop in correct dependency order
models.TicketMessage.__table__.drop(engine, checkfirst=True)
models.Ticket.__table__.drop(engine, checkfirst=True)
models.User.__table__.drop(engine, checkfirst=True)

print("Recreating tables with new relational schema...")
# This will recreate the dropped tables with the new columns
models.Base.metadata.create_all(bind=engine)

print("Success! Your database is now up to date.")