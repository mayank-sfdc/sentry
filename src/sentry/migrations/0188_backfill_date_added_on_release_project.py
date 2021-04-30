# Generated by Django 1.11.29 on 2021-04-30 13:08

from django.db import migrations, models

from sentry.utils.query import RangeQuerySetWrapperWithProgressBar


def backfill_date_added(apps, schema_editor):
    """
    Fill the new ReleaseProject.date_added column with values from the Release.date_added
    """
    ReleaseProject = apps.get_model("sentry", "ReleaseProject")
    Release = apps.get_model("sentry", "Release")
    all_releases = Release.objects.all()
    for release in RangeQuerySetWrapperWithProgressBar(all_releases):
        release_project = ReleaseProject.objects.get(release=release)
        release_project.date_added = release.date_added
        release_project.save()


class Migration(migrations.Migration):
    # This flag is used to mark that a migration shouldn't be automatically run in
    # production. We set this to True for operations that we think are risky and want
    # someone from ops to run manually and monitor.
    # General advice is that if in doubt, mark your migration as `is_dangerous`.
    # Some things you should always mark as dangerous:
    # - Large data migrations. Typically we want these to be run manually by ops so that
    #   they can be monitored. Since data migrations will now hold a transaction open
    #   this is even more important.
    # - Adding columns to highly active tables, even ones that are NULL.
    is_dangerous = True

    # This flag is used to decide whether to run this migration in a transaction or not.
    # By default we prefer to run in a transaction, but for migrations where you want
    # to `CREATE INDEX CONCURRENTLY` this needs to be set to False. Typically you'll
    # want to create an index concurrently when adding one to an existing table.
    # You'll also usually want to set this to `False` if you're writing a data
    # migration, since we don't want the entire migration to run in one long-running
    # transaction.
    atomic = False

    dependencies = [
        ("sentry", "0187_backfill_me_or_none"),
    ]

    operations = [
        migrations.AddField(
            model_name="releaseproject",
            name="date_added",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.RunPython(backfill_date_added, migrations.RunPython.noop),
    ]
