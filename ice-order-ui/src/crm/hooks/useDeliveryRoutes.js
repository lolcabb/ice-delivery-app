import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getDeliveryRoutes } from '../../api/customers.js'
import { request } from '../../api/base.js'

export function useDeliveryRoutes() {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['deliveryRoutes'],
    queryFn: async () => {
      const { data } = await getDeliveryRoutes()
      return data || []
    }
  })

  const saveRoute = useMutation({
    mutationFn: ({ id, data }) => id ? request(`/customers/delivery-routes/${id}`, 'PUT', data) : request('/customers/delivery-routes', 'POST', data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['deliveryRoutes'] })
  })

  const toggleRoute = useMutation({
    mutationFn: route => request(`/customers/delivery-routes/${route.route_id}`, 'PUT', { ...route, is_active: !route.is_active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['deliveryRoutes'] })
  })

  return { ...query, saveRoute: saveRoute.mutateAsync, toggleRoute: toggleRoute.mutateAsync }
}
