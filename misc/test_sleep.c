#include <stdio.h>
#include <unistd.h>

int main() {
	int x = 0;
	while (1) {
		printf("%d\n", x++);
		sleep(1);
	}
}
