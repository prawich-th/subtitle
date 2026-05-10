let subtitleID = 0;

export const getCurrentSession = () => {
  return {
    subtitleID,
  };
};

export const setCurrentSession = (id: number) => {
  subtitleID = id;
};
