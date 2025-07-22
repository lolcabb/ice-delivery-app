import { useMutation, useQueryClient } from '@tanstack/react-query'
import { addCustomer, updateCustomer, deleteCustomer } from '../../api/customers.js'

export default function useCustomerMutations() {
  const queryClient = useQueryClient()

  const add = useMutation({
    mutationFn: addCustomer,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['customers'] })
  })

  const update = useMutation({
    mutationFn: ({ id, data }) => updateCustomer(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['customers'] })
  })

  const remove = useMutation({
    mutationFn: deleteCustomer,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['customers'] })
  })

  return { addCustomer: add.mutateAsync, updateCustomer: update.mutateAsync, deleteCustomer: remove.mutateAsync }
}
