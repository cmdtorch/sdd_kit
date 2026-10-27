# Apply Report

## Manual checks

All six are checked in the repeat pilot: the monorepo scaffold planned again with the updated kit, in the same
project and environment as the first pilot (`/home/coder/project/ssh2-qa-test`, remote Docker).

### workflow/autonomous-apply :: Planning complete, nothing blocks
Reason: cannot be automated: agent behaviour in a real session, checked in the repeat pilot
Steps: after the planning rounds run `/opsx:apply` and follow the session to the end without giving any instruction that is not asked for
Expected: the agent asks nothing except at the stops of `openspec/protocols/apply.md` §2; every task, the test review, the full suite and the E2E stage (or its recorded skip) are done

### workflow/autonomous-apply :: No task for the developer in the task list
Reason: cannot be automated: agent behaviour in a real session, checked in the repeat pilot
Steps: read the `tasks.md` the agent writes in the pilot
Expected: no task asks a human to check something by hand; the manual rows of the plan appear only under "Manual checks" in `apply-report.md`

### workflow/autonomous-apply :: Change ready to archive
Reason: cannot be automated: agent behaviour in a real session, checked in the repeat pilot
Steps: let the pilot run to its end
Expected: the last message says the change is ready to archive, names `apply-report.md` and `/opsx:archive`; the agent does not run the archive

### workflow/environment-check :: Agent proposes the list
Reason: cannot be automated: agent behaviour in a real session, checked in the repeat pilot
Steps: start the pilot without `openspec/project-tools`
Expected: at the first start check the agent proposes the tools from the project's README (e.g. `docker — stack, E2E`) and writes the file only after you confirm

### workflow/environment-check :: Ports unreachable
Reason: cannot be automated: agent behaviour in a real session, checked in the repeat pilot
Steps: run the pilot with the remote Docker, whose published ports are refused
Expected: the agent stops before the first task, reports the refused ports, offers three ways for E2E and two for the integration checks, and does nothing else until you choose; it does not change Docker or stop other programs

### workflow/manual-checks :: Two unverified entries
Reason: cannot be automated: agent behaviour in a real session, checked in the repeat pilot
Steps: in the pilot leave at least two entries under "Not verified automatically" without consent (e.g. checks that could not run)
Expected: at the end the agent asks one question that lists them; after the answer each agreed entry carries `Consent:` with your words

## Not verified automatically

None.

## Weakened tests

None.
