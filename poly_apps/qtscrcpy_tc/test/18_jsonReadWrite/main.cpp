#if 0
#include <QJsonArray>
#include <QJsonDocument>
#include <QJsonObject>
#include <QJsonParseError>
#include <QJsonValue>
#include <QString>
#include <QDebug>
#include <QFile>
#include <QDateTime>
#include <QDir>

int main(int argc, char *argv[]) {
// 以读写方式打开主目录下的1.json文件，若该文件不存在则会自动创建
    QFile file(QDir::homePath() + "/1.json");
    QString path = QDir::homePath() + "/1.json";
    qDebug(path.toUtf8());
    if(!file.open(QIODevice::ReadWrite)) {
        qDebug() << "File open error";
    } else {
        qDebug() <<"File open!";
    }
// 使用QJsonObject对象插入键值对。
    QJsonObject jsonObject;
    jsonObject.insert("name", "tom");
    jsonObject.insert("age", "18");
    jsonObject.insert("time", QDateTime::currentDateTime().toString());

// 使用QJsonDocument设置该json对象
    QJsonDocument jsonDoc;
    jsonDoc.setObject(jsonObject);

// 将json以文本形式写入文件并关闭文件。
    file.write(jsonDoc.toJson());
    file.close();

    qDebug() << "Write to file";
    return 0;
}
#endif

#include <QJsonArray>
#include <QJsonDocument>
#include <QJsonObject>
#include <QJsonParseError>
#include <QJsonValue>
#include <QString>
#include <QDebug>
#include <QFile>
#include <QDateTime>
#include <QDir>

int main(int argc, char *argv[]) {
    // 以读写方式打开主目录下的1.json文件，若该文件不存在则会自动创建
    QFile file(QDir::homePath() + "/1.json");
    if(!file.open(QIODevice::ReadWrite)) {
        qDebug() << "File open error";
    } else {
        qDebug() <<"File open!";
    }

    // 清空文件中的原有内容
    file.resize(0);

    // 使用QJsonArray添加值，并写入文件
    QJsonArray jsonArray;
    jsonArray.append("name");
    jsonArray.append(18);
    jsonArray.append(QDateTime::currentDateTime().toString());

    QJsonDocument jsonDoc;
    jsonDoc.setArray(jsonArray);

    file.write(jsonDoc.toJson());
    file.close();

    qDebug() << "Write to file";
    return 0;
}

#if 0
QByteArray byte;
QFile file(file_path);
if(file.exists()){
        file.open(QIODevice::ReadOnly|QIODevice::Text);
        byte=file.readAll();
        file.close();
    }
else
    {
        cout<<"openFileError"<<endl;;
    }
QJsonParseError json_error;
QJsonDocument jsonDoc(QJsondocument::fromJson(byte,&json_error));
if(json_error!=QJsonParseError::NoError)
    {
        cout<<" json error "<<endl;
    }
QJsonObject rootobj=jsonDoc.object();
//一般需要使用 rootobj.contains(xxx) 判断一下是否存在 这里我们就默认是存在的 。

QJsonObject A_obj=rootobj.value("A").toObject();
A_obj["AA"]=33;

QJsonArray B_array=rootobj.value("B").toArray();
QJsonObject B_Subobj=B_array[0].toObject();
QJsonArray b_array=B_Subobj.value("BB").toArray();
b_array.replace(0,"BBB");
B_Subobj["BB"]=b_array;
B_array.replace(0,B_Subobj);

QJsonObject C_obj=rootobj.value("C").toObject();
QJsonArray c_array=C_obj.value("CC").toArray();
c_array.replace(0,"CCC");
C_obj["CC"]=c_array;

rootobj["A"]=A_obj;
rootobj["B"]=B_array;
rootobj["C"]=C_obj;

QFile file(file_path);
if(file.exists()){
        file.open(QIODevice::WriteOnly|QIODevice::Text);
        jsonDoc.setObject(rootobj);
        file.seek(0);
        file.write(jsonDoc.toJson());
        file.flush();
        file.close();
}
#endif

#if 0
#include <QCoreApplication>
#include <QJsonArray>
#include <QJsonDocument>
#include <QJsonObject>
#include <QJsonParseError>
#include <QFile>
#include <QDateTime>
int main(int argc, char *argv[])
{
    QCoreApplication a(argc, argv);
    QFile file("F:/1.json");
    if (file.open(QFile::ReadWrite))
    {
        QByteArray data=file.readAll();
        file.resize(0);//clear
        QJsonParseError jsError;
        QJsonDocument jsDoc(QJsonDocument::fromJson(data,&jsError));
        QJsonObject rootObj=jsDoc.object();
        QJsonObject subObj;//Map key:value
        subObj.insert("Name","Tom");
        subObj.insert("Age",18);
        subObj.insert("Birth",QDateTime::currentDateTime().toString());
        rootObj.insert("Tom",subObj);
        QJsonArray subArr;//List value
        subArr.append("Jerry");
        subArr.append(18);
        subArr.append(QDateTime::currentDateTime().toString());
        rootObj.insert("Jerry",subArr);
        jsDoc.setObject(rootObj);
        file.write(jsDoc.toJson());
        file.close();
    }
    return a.exec();
}
#endif