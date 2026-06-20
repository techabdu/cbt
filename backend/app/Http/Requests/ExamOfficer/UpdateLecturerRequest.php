<?php

namespace App\Http\Requests\ExamOfficer;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateLecturerRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $lecturerId = $this->route('lecturer')?->id;

        return [
            'name'      => ['required', 'string', 'max:255'],
            'email'     => ['nullable', 'string', 'email', 'max:255',
                Rule::unique('users', 'email')->ignore($lecturerId)],
            'is_active' => ['sometimes', 'boolean'],
        ];
    }
}
