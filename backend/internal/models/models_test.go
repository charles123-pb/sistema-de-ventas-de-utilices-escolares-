package models

import "testing"

func TestMoney(t *testing.T) {
	for s, n := range map[string]int64{
		"3.50": 350, "0.01": 1, "3.5": 350, "0": 0, "1000000.00": 100000000} {
		v, e := Money(s)
		if e != nil || v != n {
			t.Fatal(s, v, e)
		}
	}
	for _, s := range []string{
		"-1", "1.234", "1e2", "NaN", "1000001.00", "3,50"} {
		if _, e := Money(s); e == nil {
			t.Fatal(s)
		}
	}
}
