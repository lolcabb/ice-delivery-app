import { useQuery } from '@tanstack/react-query'
import { getCustomers } from '../../api/customers.js'

export default function useCustomers({ page, limit, filters }) {
  return useQuery({
    queryKey: ['customers', { page, limit, filters }],
    queryFn: async () => {
      const params = { ...filters, page, limit }
      Object.keys(params).forEach(k => {
        if (params[k] === '' || params[k] === null || params[k] === undefined) delete params[k]
      })
      return getCustomers(params)
    },
    keepPreviousData: true
  })
}
