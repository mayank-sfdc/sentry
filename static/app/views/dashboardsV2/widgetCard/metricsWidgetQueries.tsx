import * as React from 'react';
import cloneDeep from 'lodash/cloneDeep';
import isEqual from 'lodash/isEqual';
import omit from 'lodash/omit';

import {doMetricsRequest} from 'sentry/actionCreators/metrics';
import {Client} from 'sentry/api';
import {isSelectionEqual} from 'sentry/components/organizations/pageFilters/utils';
import {t} from 'sentry/locale';
import {MetricsApiResponse, OrganizationSummary, PageFilters} from 'sentry/types';
import {Series} from 'sentry/types/echarts';
import {TableDataWithTitle} from 'sentry/utils/discover/discoverQuery';
import {TOP_N} from 'sentry/utils/discover/types';
import {transformMetricsResponseToSeries} from 'sentry/utils/metrics/transformMetricsResponseToSeries';

import {DisplayType, Widget} from '../types';
import {getWidgetInterval} from '../utils';

type Props = {
  api: Client;
  children: (
    props: Pick<State, 'loading' | 'timeseriesResults' | 'tableResults' | 'errorMessage'>
  ) => React.ReactNode;
  organization: OrganizationSummary;
  selection: PageFilters;
  widget: Widget;
  limit?: number;
};

type State = {
  loading: boolean;
  errorMessage?: string;
  queryFetchID?: symbol;
  rawResults?: MetricsApiResponse[];
  tableResults?: TableDataWithTitle[];
  timeseriesResults?: Series[];
};

class MetricsWidgetQueries extends React.Component<Props, State> {
  state: State = {
    loading: true,
    queryFetchID: undefined,
    errorMessage: undefined,
    timeseriesResults: undefined,
    rawResults: undefined,
    tableResults: undefined,
  };

  componentDidMount() {
    this._isMounted = true;
    this.fetchData();
  }

  componentDidUpdate(prevProps: Props) {
    const {loading, rawResults} = this.state;
    const {selection, widget, organization, limit} = this.props;
    const ignroredWidgetProps = [
      'queries',
      'title',
      'id',
      'layout',
      'tempId',
      'widgetType',
    ];
    const ignoredQueryProps = ['name'];
    const widgetQueryNames = widget.queries.map(q => q.name);
    const prevWidgetQueryNames = prevProps.widget.queries.map(q => q.name);

    if (
      limit !== prevProps.limit ||
      organization.slug !== prevProps.organization.slug ||
      !isSelectionEqual(selection, prevProps.selection) ||
      !isEqual(
        omit(widget, ignroredWidgetProps),
        omit(prevProps.widget, ignroredWidgetProps)
      ) ||
      !isEqual(
        widget.queries.map(q => omit(q, ignoredQueryProps)),
        prevProps.widget.queries.map(q => omit(q, ignoredQueryProps))
      )
    ) {
      this.fetchData();
      return;
    }

    // If the query names have changed, then update timeseries labels
    if (
      !loading &&
      !isEqual(widgetQueryNames, prevWidgetQueryNames) &&
      rawResults?.length === widget.queries.length
    ) {
      // eslint-disable-next-line react/no-did-update-set-state
      this.setState(prevState => {
        return {
          ...prevState,
          timeseriesResults: prevState.rawResults?.flatMap((rawResult, index) =>
            transformMetricsResponseToSeries(rawResult, widget.queries[index].name)
          ),
        };
      });
    }
  }

  componentWillUnmount() {
    this._isMounted = false;
  }

  private _isMounted: boolean = false;

  fetchTabularData(_queryFetchID: symbol) {
    this.setState({loading: false, tableResults: []});
    // TODO(dam): implement the rest
  }

  fetchTimeseriesData(queryFetchID: symbol) {
    const {selection, api, organization, widget} = this.props;
    this.setState({loading: false, timeseriesResults: [], rawResults: []});
    const {environments, projects, datetime} = selection;
    const {start, end, period} = datetime;
    const interval = getWidgetInterval(widget, {start, end, period});

    const promises = widget.queries.map(query => {
      const requestData = {
        field: query.fields,
        orgSlug: organization.slug,
        end,
        environment: environments,
        // groupBy: query.groupBy // TODO(dam): add backend groupBy support
        interval,
        limit: widget.displayType === DisplayType.TOP_N ? TOP_N : undefined,
        orderBy: query.orderby,
        project: projects,
        query: query.conditions,
        start,
        statsPeriod: period,
      };
      return doMetricsRequest(api, requestData);
    });

    let completed = 0;
    promises.forEach(async (promise, requestIndex) => {
      try {
        const rawResults = await promise;
        if (!this._isMounted) {
          return;
        }
        this.setState(prevState => {
          if (prevState.queryFetchID !== queryFetchID) {
            // invariant: a different request was initiated after this request
            return prevState;
          }

          const timeseriesResults = [...(prevState.timeseriesResults ?? [])];
          const transformedResult = transformMetricsResponseToSeries(
            rawResults,
            widget.queries[requestIndex].name
          );

          // When charting timeseriesData on echarts, color association to a timeseries result
          // is order sensitive, ie series at index i on the timeseries array will use color at
          // index i on the color array. This means that on multi series results, we need to make
          // sure that the order of series in our results do not change between fetches to avoid
          // coloring inconsistencies between renders.
          transformedResult.forEach((result, resultIndex) => {
            timeseriesResults[requestIndex * transformedResult.length + resultIndex] =
              result;
          });

          const rawResultsClone = cloneDeep(prevState.rawResults ?? []);
          rawResultsClone[requestIndex] = rawResults;

          return {
            ...prevState,
            timeseriesResults,
            rawResults: rawResultsClone,
          };
        });
      } catch (err) {
        const errorMessage = err?.responseJSON?.detail || t('An unknown error occurred.');
        this.setState({errorMessage});
      } finally {
        completed++;
        if (!this._isMounted) {
          return;
        }
        this.setState(prevState => {
          if (prevState.queryFetchID !== queryFetchID) {
            // invariant: a different request was initiated after this request
            return prevState;
          }

          return {
            ...prevState,
            loading: completed === promises.length ? false : true,
          };
        });
      }
    });
  }

  fetchData() {
    const {widget} = this.props;

    if (widget.displayType === DisplayType.WORLD_MAP) {
      this.setState({errorMessage: t('World Map is not supported by metrics.')});
      return;
    }

    const queryFetchID = Symbol('queryFetchID');
    this.setState({loading: true, errorMessage: undefined, queryFetchID});

    if (['table', 'big_number'].includes(widget.displayType)) {
      this.fetchTabularData(queryFetchID);
    } else {
      this.fetchTimeseriesData(queryFetchID);
    }
  }

  render() {
    const {children} = this.props;
    const {loading, timeseriesResults, tableResults, errorMessage} = this.state;

    return children({
      loading,
      timeseriesResults,
      tableResults,
      errorMessage,
    });
  }
}

export default MetricsWidgetQueries;
