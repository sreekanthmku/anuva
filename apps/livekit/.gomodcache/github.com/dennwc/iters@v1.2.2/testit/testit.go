package testit

import (
	"context"
	"testing"

	"github.com/shoenig/test/must"

	"github.com/dennwc/iters"
)

func checkRes[T any](t testing.TB, exp, got []T, expErr, gotErr error) {
	t.Helper()
	if expErr != nil {
		must.Eq(t, expErr, gotErr)
	} else {
		must.NoError(t, gotErr)
	}
	must.Eq(t, exp, got)
}

func ExpectIter[T any](t testing.TB, exp []T, expErr error, it iters.Iter[T]) {
	defer it.Close()
	got, err := iters.All(it)
	checkRes(t, exp, got, expErr, err)
}

func ExpectIterCtx[T any](t testing.TB, exp []T, expErr error, it iters.IterCtx[T]) {
	ctx := context.Background()
	defer it.Close()
	got, err := iters.AllCtx(ctx, it)
	checkRes(t, exp, got, expErr, err)
}

func ExpectPageIter[T any](t testing.TB, exp []T, expErr error, it iters.PageIter[T]) {
	ctx := context.Background()
	defer it.Close()
	got, err := iters.AllPages(ctx, it)
	checkRes(t, exp, got, expErr, err)
}
