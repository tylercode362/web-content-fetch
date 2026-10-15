## ADDED Requirements

### Requirement: Request the authorized chapter page budget
WCF SHALL request at most 1000 pages per chapter through the existing maxPages field while leaving site-specific caps and other resource budgets unchanged.

#### Scenario: Manga or novel chapter request
- **Given** an authorized manga or novel job
- **When** WCF sends a chapter request
- **Then** maxPages is 1000 rather than 512
- **And** chapter and image budgets retain their existing values

#### Scenario: A site has a lower cap
- **Given** a Bridge site rule whose page cap is below 1000
- **When** WCF requests maxPages 1000
- **Then** the Bridge remains responsible for enforcing the lower site cap without WCF replacing the rule
