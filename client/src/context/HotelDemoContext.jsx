import { createContext, useContext, useMemo, useReducer } from 'react';

const HotelDemoContext = createContext(null);

function swipeReducer(state, action) {
  if (action.type === 'decide') {
    const previous = state.decisions[action.hotel.id] ?? null;
    return {
      decisions: {
        ...state.decisions,
        [action.hotel.id]: { choice: action.choice, hotel: action.hotel },
      },
      history: [...state.history, { hotelId: action.hotel.id, previous }],
    };
  }

  if (action.type === 'undo') {
    const lastAction = state.history.at(-1);
    if (!lastAction) return state;

    const decisions = { ...state.decisions };
    if (lastAction.previous) decisions[lastAction.hotelId] = lastAction.previous;
    else delete decisions[lastAction.hotelId];

    return { decisions, history: state.history.slice(0, -1) };
  }

  return state;
}

export function HotelDemoProvider({ children }) {
  const [state, dispatch] = useReducer(swipeReducer, { decisions: {}, history: [] });
  const value = useMemo(
    () => ({
      decisions: state.decisions,
      decisionHistory: state.history,
      likedHotels: Object.values(state.decisions)
        .filter((decision) => decision.choice === 'like')
        .map((decision) => decision.hotel),
      decide: (hotel, choice) => dispatch({ type: 'decide', hotel, choice }),
      undo: () => dispatch({ type: 'undo' }),
    }),
    [state],
  );

  return <HotelDemoContext.Provider value={value}>{children}</HotelDemoContext.Provider>;
}

export function useHotelDemo() {
  const context = useContext(HotelDemoContext);
  if (!context) {
    throw new Error('useHotelDemo must be used within HotelDemoProvider');
  }
  return context;
}
