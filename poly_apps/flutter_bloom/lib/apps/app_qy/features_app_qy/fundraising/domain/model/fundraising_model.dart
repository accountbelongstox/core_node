class FundraisingResultsModel{
   String results;
   String resultstype;
   FundraisingResultsModel(
      { required this.results, required this.resultstype});
}

List<FundraisingResultsModel>fundraisinglist =[
  FundraisingResultsModel(
    results: "\$8,775.",
    resultstype: "Funds gained",
  ),
  FundraisingResultsModel(
    results: "\$1,765",
    resultstype: "Funds left",
  ),
  FundraisingResultsModel(
    results: "4.471",
    resultstype: "Donators",
  ),
    FundraisingResultsModel(
    results: "9",
    resultstype: "Days Left",
  ),
  FundraisingResultsModel(
    results: "82%",
    resultstype: "Funds reached",
  ),
  FundraisingResultsModel(
    results: "2.389%",
    resultstype: "Prayers",
  ),

];