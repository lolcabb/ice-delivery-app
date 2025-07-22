import { useState, useEffect, useRef } from 'react'

export default function useCustomerFilters(initial = { search: '', route_id: '', customer_type: '', is_active: 'true' }) {
  const [filters, setFilters] = useState(initial)
  const [localSearchTerm, setLocalSearchTerm] = useState('')
  const [localCustomerType, setLocalCustomerType] = useState('')
  const [pagination, setPagination] = useState({ page: 1, limit: 10, totalPages: 1, totalItems: 0 })
  const debounceRef = useRef(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setFilters(prev => ({ ...prev, search: localSearchTerm, customer_type: localCustomerType }))
      setPagination(prev => ({ ...prev, page: 1 }))
    }, 500)
    return () => clearTimeout(debounceRef.current)
  }, [localSearchTerm, localCustomerType])

  const handleFilterChange = e => {
    const { name, value } = e.target
    if (name === 'search') setLocalSearchTerm(value)
    else if (name === 'customer_type') setLocalCustomerType(value)
    else {
      setFilters(prev => ({ ...prev, [name]: value }))
      setPagination(prev => ({ ...prev, page: 1 }))
    }
  }

  const handlePageChange = page => setPagination(prev => ({ ...prev, page }))

  return { filters, localSearchTerm, localCustomerType, pagination, setPagination, handleFilterChange, handlePageChange }
}
