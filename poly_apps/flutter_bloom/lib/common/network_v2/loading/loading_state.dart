class LoadingState {
  const LoadingState({required this.activeRequests, required this.queueDepth});

  final int activeRequests;
  final int queueDepth;

  bool get isLoading => activeRequests > 0 || queueDepth > 0;
}
