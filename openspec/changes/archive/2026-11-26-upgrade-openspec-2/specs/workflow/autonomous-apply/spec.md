# Spec Delta

## MODIFIED Requirements

### Requirement: Ready message
When everything is done the agent SHALL tell the developer that the change is ready to archive, name the implementation report, and give the archive command; it SHALL NOT archive the change itself.

#### Scenario: Change ready to archive
- **WHEN** every task is done, the consent list is answered and the archive checks pass
- **THEN** the agent's message names `apply-report.md` and the command `/openspec-archive-change`
- **AND** the agent does not run the archive
