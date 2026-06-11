/** Styles react-select pour mode clair / sombre */
export function getSelectStyles(isDark) {
  return {
    control: (base, state) => ({
      ...base,
      backgroundColor: isDark ? '#1e293b' : '#ffffff',
      borderColor: state.isFocused ? '#667eea' : isDark ? '#334155' : '#e2e8f0',
      boxShadow: state.isFocused ? '0 0 0 1px #667eea' : 'none',
      minHeight: 42,
      '&:hover': { borderColor: '#667eea' },
    }),
    menu: (base) => ({
      ...base,
      backgroundColor: isDark ? '#1e293b' : '#ffffff',
      border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
      zIndex: 9999,
    }),
    option: (base, state) => ({
      ...base,
      backgroundColor: state.isSelected
        ? '#667eea'
        : state.isFocused
          ? isDark
            ? '#334155'
            : '#eef2ff'
          : 'transparent',
      color: state.isSelected ? '#fff' : isDark ? '#f1f5f9' : '#1e293b',
      cursor: 'pointer',
    }),
    singleValue: (base) => ({
      ...base,
      color: isDark ? '#f1f5f9' : '#1e293b',
    }),
    input: (base) => ({
      ...base,
      color: isDark ? '#f1f5f9' : '#1e293b',
    }),
    placeholder: (base) => ({
      ...base,
      color: isDark ? '#94a3b8' : '#64748b',
    }),
    multiValue: (base) => ({
      ...base,
      backgroundColor: isDark ? '#334155' : '#eef2ff',
    }),
    multiValueLabel: (base) => ({
      ...base,
      color: isDark ? '#f1f5f9' : '#4338ca',
    }),
    indicatorSeparator: (base) => ({
      ...base,
      backgroundColor: isDark ? '#475569' : '#e2e8f0',
    }),
    dropdownIndicator: (base) => ({
      ...base,
      color: isDark ? '#94a3b8' : '#64748b',
    }),
    clearIndicator: (base) => ({
      ...base,
      color: isDark ? '#94a3b8' : '#64748b',
    }),
  };
}
