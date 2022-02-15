import styled from '@emotion/styled';

import space from 'sentry/styles/space';
import {Organization, PageFilters} from 'sentry/types';

import ProjectApdexScoreCard from './projectApdexScoreCard';
import ProjectStabilityScoreCard from './projectStabilityScoreCard';
import ProjectVelocityScoreCard from './projectVelocityScoreCard';

type Props = {
  hasSessions: boolean | null;
  isProjectStabilized: boolean;
  organization: Organization;
  selection: PageFilters;
  hasTransactions?: boolean;
  query?: string;
};

function ProjectScoreCards({
  organization,
  selection,
  isProjectStabilized,
  hasSessions,
  hasTransactions,
  query,
}: Props) {
  return (
    <CardWrapper>
      <ProjectStabilityScoreCard
        organization={organization}
        selection={selection}
        isProjectStabilized={isProjectStabilized}
        hasSessions={hasSessions}
        query={query}
      />

      <ProjectVelocityScoreCard
        organization={organization}
        selection={selection}
        isProjectStabilized={isProjectStabilized}
        query={query}
      />

      <ProjectApdexScoreCard
        organization={organization}
        selection={selection}
        isProjectStabilized={isProjectStabilized}
        hasTransactions={hasTransactions}
        query={query}
      />
    </CardWrapper>
  );
}

const CardWrapper = styled('div')`
  @media (min-width: ${p => p.theme.breakpoints[1]}) {
    display: grid;
    grid-column-gap: ${space(2)};
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
`;

export default ProjectScoreCards;
