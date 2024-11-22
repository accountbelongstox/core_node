class SourceInterface {
    constructor(){
    }

    
    getDriverPathByChrome() {
        throw new Error('You have to implement the method connect!');
    }

}

SourceInterface.toString = () => '[class SourceInterface]';
module.exports =  {
    SourceInterface
}
