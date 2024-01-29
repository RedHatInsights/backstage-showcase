import React from 'react';
import {
  Table,
  TableColumn,
  Progress,
  ResponseErrorPanel,
} from '@backstage/core-components';
import useAsync from 'react-use/lib/useAsync';
import { useApi, configApiRef } from '@backstage/core-plugin-api';
import { Typography } from '@material-ui/core';
import { InfoCard } from '@backstage/core-components';
import { useEntity } from '@backstage/plugin-catalog-react';

interface DenseTableProps {
  incidents?: IncidentList;
  web_rca_url?: string;
  message?: string;
}

interface Incident {
  id?: string;
  kind?: string;
  href?: string;
  incident_id?: string;
  summary?: string;
  description?: string;
}

interface IncidentList {
  kind: 'IncidentList';
  page?: number;
  size?: number;
  total?: number;
  items?: Incident[];
  errorMsg?: string;
}

interface product {
  id: string;
  kind: string;
  href: string;
  name: string;
  fullname: string;
}

interface productList {
  items: product[];
}

interface FetchProps {
  product?: string;
}

export const DenseTable = ({
  incidents,
  web_rca_url,
  message,
}: DenseTableProps) => {
  if (message) {
    return (
      <InfoCard title="Error fetching incidents">
        <Typography variant="body1">{message}</Typography>
      </InfoCard>
    );
  }

  if (!incidents || !incidents.items || incidents.items.length === 0) {
    return (
      <InfoCard title="Error fetching incidents">
        <Typography variant="body1">"No Incidents"</Typography>
      </InfoCard>
    );
  }

  const columns: TableColumn[] = [
    { title: 'ID', field: 'incident_id' },
    { title: 'Summary', field: 'summary' },
    { title: 'Description', field: 'description' },
  ];

  const data = incidents.items.map(inc => {
    return {
      // incident_id: <a target="_blank" rel="noreferrer" href={`https://web-rca.stage.devshift.net/incident/${inc.incident_id}/events`}>{inc.incident_id}</a>,
      incident_id: (
        <a
          target="_blank"
          rel="noreferrer"
          href={`${web_rca_url}/incident/${inc.incident_id}/events`}
        >
          {inc.incident_id}
        </a>
      ),
      summary: inc.summary,
      description: inc.description,
    };
  });

  return (
    <Table
      title="Incidents"
      options={{ search: true, paging: true, pageSize: 10 }}
      columns={columns}
      data={data}
    />
  );
};

async function refresh(url: string, offline_token: string) {
  // @REF [URL Encoded form body](https://stackoverflow.com/questions/35325370/how-do-i-post-a-x-www-form-urlencoded-request-using-fetch/37562814#37562814)
  const details: { [index: string]: string } = {
    grant_type: 'refresh_token',
    client_id: 'cloud-services',
    refresh_token: `${offline_token}`,
  };

  const formBody = [];
  for (const property in details) {
    if (Object.prototype.hasOwnProperty.call(details, property)) {
      const encodedKey: string = encodeURIComponent(property);
      const encodedValue: string = encodeURIComponent(details[property]);
      formBody.push(`${encodedKey}=${encodedValue}`);
    }
  }
  const formBodyString = formBody.join('&');

  return await fetch(
    `${url}/api/proxy/sso-redhat/auth/realms/redhat-external/protocol/openid-connect/token`,
    {
      method: 'POST',
      body: formBodyString,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    },
  )
    .catch(error => error)
    .then(resp => resp.json());
}

async function lookupProduct(
  url: string,
  access_token: string,
  product_name: string,
): Promise<productList> {
  return (await fetch(
    `${url}/api/proxy/status-board/products?search=fullname+ilike+'${product_name}'`,
    {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    },
  )
    .catch(error => error)
    .then(resp => resp.json())) as productList;
}

export const WebRCAFetchComponent = ({ product }: FetchProps) => {
  const config = useApi(configApiRef);
  const entity = useEntity();

  const { value, loading, error } = useAsync(async (): Promise<
    IncidentList | string
  > => {
    const token = await refresh(
      config.getString('backend.baseUrl'),
      config.getString('ocm.token'),
    );

    let products = '';
    if (product) {
      // console.log(`Filtering by product: ${product}`)
      const p = await lookupProduct(
        config.getString('backend.baseUrl'),
        token.access_token,
        product,
      );
      if (p.items.length > 0) {
        products = `?product_id=${p.items[0].id}`;
      }
    }
    if (entity) {
      // console.log(`Filtering by entity: ${entity}`)
      const p = await lookupProduct(
        config.getString('backend.baseUrl'),
        token.access_token,
        entity.entity.metadata.name,
      );
      if (p.items.length > 0) {
        products = `?product_id=${p.items[0].id}`;
      }
    }

    if (products === '') {
      return 'No product based on entity';
    }

    // TODO: Filter by status?  Add a toggle?
    const incidentList = fetch(
      `${config.getString(
        'backend.baseUrl',
      )}/api/proxy/web-rca/incidents${products}`,
      {
        headers: {
          Authorization: `Bearer ${token.access_token}`,
        },
      },
    )
      .then(resp => resp.json())
      .catch(e => e);

    return incidentList as Promise<IncidentList>;
  }, []);

  if (loading) {
    return <Progress />;
  }
  if (error) {
    return <ResponseErrorPanel error={error} />;
  }
  if (!value) {
    return (
      <ResponseErrorPanel
        error={{
          name: 'Foo',
          message: 'Foo',
        }}
      />
    );
  }

  if (typeof value === 'string') {
    return (
      <DenseTable
        message={value}
        web_rca_url={config.getString('ocm.web-rca-url')}
      />
    );
  }

  return (
    <DenseTable
      incidents={value}
      web_rca_url={config.getString('ocm.web-rca-url')}
    />
  );
};
