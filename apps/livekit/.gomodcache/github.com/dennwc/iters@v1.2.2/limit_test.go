package iters_test

import (
	"testing"

	. "github.com/dennwc/iters"
	"github.com/dennwc/iters/testit"
)

func TestLimitIter(t *testing.T) {
	testit.ExpectIter(t,
		[]int(nil), nil,
		Limit[int](Slice([]int{1, 2, 3}), 0),
	)
	testit.ExpectIter(t,
		[]int{1, 2, 3}, nil,
		Limit[int](Slice([]int{1, 2, 3}), -1),
	)
	testit.ExpectIter(t,
		[]int{1, 2}, nil,
		Limit[int](Slice([]int{1, 2, 3}), 2),
	)
}
