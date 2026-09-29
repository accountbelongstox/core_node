import 'package:flutter/material.dart';

class CreateFundraisingImageWidget extends StatelessWidget {
 final double height ;
 final double ?width ;
 final String ?text ;
 const CreateFundraisingImageWidget({super.key,required this .height,this .width,this.text});

  @override
  Widget build(BuildContext context) {
    return Container(
      height: height,
      width: width,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(10),
        color: Theme.of(context).hintColor.withOpacity(0.2),
      ),
      child: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.add,color: Theme.of(context).colorScheme.surfaceTint,),



          ]))
    );
  }
}
