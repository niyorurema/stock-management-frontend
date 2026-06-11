import React, { createContext, useContext, useState, useCallback } from 'react';

const ActionContext = createContext();

const EMPTY_ACTIONS = {
  add: null,
  export: null,
  print: null,
  filter: null,
  refresh: null,
};

export const useAction = () => useContext(ActionContext);

export const ActionProvider = ({ children }) => {
  const [currentPageActions, setCurrentPageActions] = useState({ ...EMPTY_ACTIONS });

  const registerAction = useCallback((actionName, callback) => {
    setCurrentPageActions((prev) => ({
      ...prev,
      [actionName]: callback,
    }));
  }, []);

  const unregisterAction = useCallback((actionName) => {
    setCurrentPageActions((prev) => ({
      ...prev,
      [actionName]: null,
    }));
  }, []);

  const clearAllActions = useCallback(() => {
    setCurrentPageActions({ ...EMPTY_ACTIONS });
  }, []);

  const hasAction = useCallback(
    (actionName) => typeof currentPageActions[actionName] === 'function',
    [currentPageActions]
  );

  const triggerAction = useCallback(
    (actionName) => {
      if (typeof currentPageActions[actionName] === 'function') {
        currentPageActions[actionName]();
      }
    },
    [currentPageActions]
  );

  const availableActions = Object.keys(currentPageActions).filter(
    (key) => typeof currentPageActions[key] === 'function'
  );

  return (
    <ActionContext.Provider
      value={{
        registerAction,
        unregisterAction,
        clearAllActions,
        hasAction,
        triggerAction,
        availableActions,
      }}
    >
      {children}
    </ActionContext.Provider>
  );
};
