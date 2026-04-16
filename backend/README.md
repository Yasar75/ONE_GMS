


# Prerequisites
Ensure you have the following installed:

- Python >= 3.10
- PostgreSQL

 

Install the required dependencies:
    ```bash
    pip install -r requirements.txt
    ```




# Running the Application
```bash
fastapi dev src/
```



# Database Migrations Workflow

## 1. Standard Workflow

> **⚠️ ⚠️VERY IMPORTANT⚠️⚠️:**
> Always run `alembic upgrade head` after taking pull having migration versions changes.

### A. Making Model Changes
1. Modify your SQLAlchemy models (e.g., add a column, create a table) in your Python code.
2. Save the files.

### B. Generating a Migration Script

Generate a new script that calculates the difference between your code and the database:

```bash
alembic revision --autogenerate -m "keep field employees type as text field"

```

> **Important:** Always inspect the generated file in `alembic/versions/`! Auto-generation is good, but it can sometimes miss complex changes (like renamed tables) or detect false positives.

### C. Applying the Migration

Apply the new script to update your actual database schema:

```bash
alembic upgrade head

```

### D. Reverting a Migration

If you broke something and need to go back one step:

```bash
alembic downgrade -1

```

To revert all the way to a clean, empty database:

```bash
alembic downgrade base

```

---

## 2. Migration Command Cheatsheet

| Action | Command |
| --- | --- |
| **Create Migration** | `alembic revision --autogenerate -m "message"` |
| **Apply Changes** | `alembic upgrade head` |
| **Undo Last Change** | `alembic downgrade -1` |
| **Show History** | `alembic history` |
| **Show Current Version** | `alembic current` |

---

## 3. Troubleshooting & Tips

### "Target database is not up to date"

This means there are migration files exists in the folder that haven't been applied to the DB yet.
**Fix:** Run `alembic upgrade head`.

### "Table already exists"

This usually happens if you created tables manually (without Alembic) but then tried to run a migration that tries to create them again.
**Fix:** You may need to "stamp" the database to tell Alembic it is already up to date without running the SQL:

```bash
alembic stamp head

```

### Handling Enums (PostgreSQL)

Alembic sometimes struggles to detect changes in Enum types automatically. You may need to edit the migration file manually to alter Enum types.

---

