import { useState, useRef, useCallback } from 'react';
import { searchEntities } from '../learningEngine';

export default function useGlobalSearch(invoices, expenses) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState({ invoices: [], expenses: [] });
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef(null);

  const handleSearch = useCallback((query) => {
    setSearchQuery(query);
    if (query.length < 2) { setSearchResults({ invoices: [], expenses: [] }); return; }
    const results = searchEntities(invoices, expenses, query);
    setSearchResults(results);
    setSearchOpen(true);
  }, [invoices, expenses]);

  return {
    searchQuery,
    setSearchQuery,
    searchResults,
    searchOpen,
    setSearchOpen,
    searchRef,
    handleSearch,
  };
}
