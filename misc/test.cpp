#include <iostream>
#include <vector>
#include <algorithm>
#include <string>
#include <sstream>
#include <iomanip>
#include <random>

using namespace std;

struct Person {
   string name;
   int age;
   double height;
};

void print_people(const vector<Person>& people) {
   for (const Person& p : people) {
      cout << "姓名：" << p.name << ", 年龄：" << p.age << ", 身高：" << fixed << setprecision(2) << p.height << endl;
   }
}

int main() {
   vector<Person> people = {
      {"小明", 25, 1.68},
      {"小王", 30, 1.80},
      {"小红", 40, 1.75},
      {"小白", 35, 1.82},
      {"小黑", 20, 1.64}
   };
   
   cout << "未排序：" << endl;
   print_people(people);
   cout << endl;
   
   sort(people.begin(), people.end(), [](const Person& a, const Person& b) {
      return a.age > b.age;
   });
   
   cout << "按年龄倒序：" << endl;
   print_people(people);
   cout << endl;
   
   sort(people.begin(), people.end(), [](const Person& a, const Person& b) {
      return a.name < b.name;
   });
   
   cout << "按姓名倒序：" << endl;
   print_people(people);
   cout << endl;
   
   string str_num = "1234";
   int num;
   stringstream(str_num) >> num;
   cout << "转换数字\"" << str_num << "\" 到数字" << num << endl;
   cout << endl;
   
   double dbl_num = 3.14159;
   stringstream ss;
   ss << fixed << setprecision(2) << dbl_num;
   string str_dbl = ss.str();
   cout << "转换数字" << dbl_num << "为字符串\"" << str_dbl << "\"" << endl;
   cout << endl;
   
   std::mt19937 rng(std::random_device{}());

   std::shuffle(people.begin(), people.end(), rng);
   
   cout << "随机打乱：" << endl;
   print_people(people);
   cout << endl;
   
   return 0;
}