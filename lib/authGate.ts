interface MandatoryAuthGateInput {
  isAuthenticated: boolean;
  isLoading: boolean;
}

interface MandatoryAuthGateState {
  canHideSplash: boolean;
  canUseAppRoutes: boolean;
  canUseAuthCallback: boolean;
  canUseLoginRoute: boolean;
}

export function getMandatoryAuthGateState({
  isAuthenticated,
  isLoading,
}: MandatoryAuthGateInput): MandatoryAuthGateState {
  return {
    canHideSplash: !isLoading,
    canUseAppRoutes: !isLoading && isAuthenticated,
    canUseAuthCallback: true,
    canUseLoginRoute: isLoading || !isAuthenticated,
  };
}
