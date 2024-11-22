
class DriverInterface {
    constructor(){
    }
    connect() {
        throw new Error('You have to implement the method connect!');
    }

    disconnect() {
        throw new Error('You have to implement the method disconnect!');
    }
    toString = () => '[class DriverInterface]';
}


class SourceInterface {
    constructor(){
    }
    
    getDriverPathByChrome() {
        throw new Error('You have to implement the method connect!');
    }
    toString = () => '[class SourceInterface]';

}


module.exports =  {
    DriverInterface,
    SourceInterface
}
